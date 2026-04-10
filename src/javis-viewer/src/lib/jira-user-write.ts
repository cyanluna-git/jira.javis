import { getUsableAtlassianConnection } from '@/lib/atlassian-oauth';

const ATLASSIAN_API_BASE_URL = 'https://api.atlassian.com';
const ISSUE_FETCH_FIELDS = [
  'project',
  'summary',
  'status',
  'description',
  'priority',
  'assignee',
  'creator',
  'reporter',
  'issuetype',
  'components',
  'versions',
  'fixVersions',
  'labels',
  'updated',
  'created',
  'attachment',
  'comment',
  'customfield_10016',
  'customfield_10033',
];

type JiraAllowedUpdateField = 'summary' | 'status' | 'assignee' | 'priority' | 'labels' | 'description';

type JiraIssueUpdateValue = string | string[] | Record<string, unknown> | null;

export type JiraIssueUpdateInput = Partial<Record<JiraAllowedUpdateField, JiraIssueUpdateValue>>;

interface JiraIssue {
  key: string;
  fields: Record<string, unknown>;
  [key: string]: unknown;
}

interface JiraTransition {
  id: string;
  name: string;
  to?: {
    name?: string;
  };
}

export interface JiraDirectUpdateResult {
  issue: JiraIssue;
  updatedFields: JiraAllowedUpdateField[];
  transitioned: boolean;
}

export class JiraWriteError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'JiraWriteError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'JIRA_WRITE_FAILED';
    this.details = options?.details;
  }
}

export async function directUpdateJiraIssue(
  appUserKey: string,
  issueKey: string,
  updates: JiraIssueUpdateInput
): Promise<JiraDirectUpdateResult> {
  const connection = await getUsableAtlassianConnection(appUserKey);
  if (!connection) {
    throw new JiraWriteError('Atlassian account is not connected for this user', {
      status: 409,
      code: 'ATLASSIAN_NOT_CONNECTED',
    });
  }

  if (!connection.capabilities.jiraWrite) {
    throw new JiraWriteError('Connected Atlassian account does not have Jira write scope', {
      status: 403,
      code: 'JIRA_SCOPE_MISSING',
    });
  }

  if (!connection.site.id) {
    throw new JiraWriteError('Connected Atlassian account is missing a selected Jira cloud site', {
      status: 409,
      code: 'JIRA_SITE_UNRESOLVED',
    });
  }

  const currentIssue = await jiraRequest<JiraIssue>(connection, 'GET', `/issue/${encodeURIComponent(issueKey)}`, {
    searchParams: {
      fields: ISSUE_FETCH_FIELDS.join(','),
    },
  });

  const normalizedUpdates = normalizeIssueUpdates(updates);
  const editFields = buildEditFields(normalizedUpdates);
  const updatedFields = Object.keys(normalizedUpdates).filter(
    (field): field is JiraAllowedUpdateField => field in normalizedUpdates
  );

  if (Object.keys(editFields).length > 0) {
    await jiraRequest(connection, 'PUT', `/issue/${encodeURIComponent(issueKey)}`, {
      json: { fields: editFields },
    });
  }

  const desiredStatus = typeof normalizedUpdates.status === 'string' ? normalizedUpdates.status : null;
  const currentStatus = readNestedString(currentIssue.fields, ['status', 'name']);
  let transitioned = false;

  if (desiredStatus && !sameStatus(currentStatus, desiredStatus)) {
    transitioned = await transitionIssueToStatus(connection, issueKey, desiredStatus);
  }

  const refreshedIssue = await jiraRequest<JiraIssue>(connection, 'GET', `/issue/${encodeURIComponent(issueKey)}`, {
    searchParams: {
      fields: ISSUE_FETCH_FIELDS.join(','),
    },
  });

  return {
    issue: refreshedIssue,
    updatedFields,
    transitioned,
  };
}

async function transitionIssueToStatus(
  connection: Awaited<ReturnType<typeof getUsableAtlassianConnection>> extends infer T ? NonNullable<T> : never,
  issueKey: string,
  desiredStatus: string
): Promise<boolean> {
  const payload = await jiraRequest<{ transitions?: JiraTransition[] }>(
    connection,
    'GET',
    `/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      searchParams: {
        expand: 'transitions.fields',
      },
    }
  );

  const transitions = Array.isArray(payload.transitions) ? payload.transitions : [];
  const transition = transitions.find((candidate) => {
    const transitionName = candidate.name?.trim().toLowerCase();
    const destinationName = candidate.to?.name?.trim().toLowerCase();
    const target = desiredStatus.trim().toLowerCase();
    return transitionName === target || destinationName === target;
  });

  if (!transition) {
    throw new JiraWriteError(`No Jira transition is available for status "${desiredStatus}"`, {
      status: 409,
      code: 'JIRA_TRANSITION_UNAVAILABLE',
      details: {
        requestedStatus: desiredStatus,
        availableTransitions: transitions.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          to: candidate.to?.name ?? null,
        })),
      },
    });
  }

  await jiraRequest(connection, 'POST', `/issue/${encodeURIComponent(issueKey)}/transitions`, {
    json: {
      transition: {
        id: transition.id,
      },
    },
  });

  return true;
}

async function jiraRequest<T = unknown>(
  connection: NonNullable<Awaited<ReturnType<typeof getUsableAtlassianConnection>>>,
  method: 'GET' | 'POST' | 'PUT',
  path: string,
  options?: {
    json?: unknown;
    searchParams?: Record<string, string>;
  }
): Promise<T> {
  const url = new URL(
    `${ATLASSIAN_API_BASE_URL}/ex/jira/${connection.site.id}/rest/api/3${path}`
  );

  Object.entries(options?.searchParams ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Accept: 'application/json',
      ...(options?.json ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.json ? JSON.stringify(options.json) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await safeJson(response);
    throw new JiraWriteError(readJiraErrorMessage(details, response.status), {
      status: response.status,
      code: 'JIRA_API_ERROR',
      details,
    });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

function normalizeIssueUpdates(updates: JiraIssueUpdateInput): JiraIssueUpdateInput {
  const normalized: JiraIssueUpdateInput = {};

  if (typeof updates.summary === 'string') {
    normalized.summary = updates.summary;
  }

  if (typeof updates.status === 'string' && updates.status.trim()) {
    normalized.status = updates.status.trim();
  }

  if (updates.assignee === null) {
    normalized.assignee = null;
  } else if (typeof updates.assignee === 'string' && updates.assignee.trim()) {
    normalized.assignee = updates.assignee.trim();
  } else if (isObject(updates.assignee)) {
    normalized.assignee = updates.assignee;
  }

  if (updates.priority === null) {
    normalized.priority = null;
  } else if (typeof updates.priority === 'string' && updates.priority.trim()) {
    normalized.priority = updates.priority.trim();
  } else if (isObject(updates.priority)) {
    normalized.priority = updates.priority;
  }

  if (Array.isArray(updates.labels)) {
    normalized.labels = updates.labels.filter(
      (label): label is string => typeof label === 'string' && Boolean(label.trim())
    );
  }

  if (updates.description === null) {
    normalized.description = null;
  } else if (typeof updates.description === 'string') {
    normalized.description = updates.description;
  } else if (isObject(updates.description)) {
    normalized.description = updates.description;
  }

  return normalized;
}

function buildEditFields(updates: JiraIssueUpdateInput): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  if (typeof updates.summary === 'string') {
    fields.summary = updates.summary;
  }

  if ('assignee' in updates) {
    fields.assignee = normalizeAssigneeValue(updates.assignee ?? null);
  }

  if ('priority' in updates) {
    fields.priority = normalizePriorityValue(updates.priority ?? null);
  }

  if (Array.isArray(updates.labels)) {
    fields.labels = updates.labels;
  }

  if ('description' in updates) {
    fields.description = normalizeDescriptionValue(updates.description ?? null);
  }

  return fields;
}

function normalizeAssigneeValue(value: JiraIssueUpdateValue): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return { accountId: value };
  }

  if (isObject(value)) {
    const accountId = readString(value, ['accountId', 'account_id', 'id']);
    if (accountId) {
      return { accountId };
    }
  }

  return null;
}

function normalizePriorityValue(value: JiraIssueUpdateValue): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return { name: value };
  }

  if (isObject(value)) {
    const id = readString(value, ['id']);
    if (id) {
      return { id };
    }

    const name = readString(value, ['name']);
    if (name) {
      return { name };
    }
  }

  return null;
}

function normalizeDescriptionValue(value: JiraIssueUpdateValue): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return {
      type: 'doc',
      version: 1,
      content: [
        {
          type: 'paragraph',
          content: value
            ? [
                {
                  type: 'text',
                  text: value,
                },
              ]
            : [],
        },
      ],
    };
  }

  if (isObject(value)) {
    return value;
  }

  return null;
}

function readJiraErrorMessage(payload: unknown, status: number): string {
  if (isObject(payload)) {
    const errorMessage = readString(payload, ['message', 'errorMessage']);
    if (errorMessage) {
      return errorMessage;
    }

    if (Array.isArray(payload.errorMessages) && payload.errorMessages.length > 0) {
      const firstMessage = payload.errorMessages.find(
        (message): message is string => typeof message === 'string' && Boolean(message.trim())
      );
      if (firstMessage) {
        return firstMessage;
      }
    }

    if (isObject(payload.errors)) {
      const fieldErrors = Object.entries(payload.errors)
        .map(([field, message]) => `${field}: ${String(message)}`)
        .join(', ');
      if (fieldErrors) {
        return fieldErrors;
      }
    }
  }

  return `Jira API request failed (${status})`;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function sameStatus(left: string | null, right: string): boolean {
  return (left ?? '').trim().toLowerCase() === right.trim().toLowerCase();
}

function readNestedString(
  source: Record<string, unknown>,
  path: string[]
): string | null {
  let current: unknown = source;
  for (const key of path) {
    if (!isObject(current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}
