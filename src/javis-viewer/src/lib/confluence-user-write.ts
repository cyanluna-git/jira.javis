import { getUsableAtlassianConnection } from '@/lib/atlassian-oauth';

const ATLASSIAN_API_BASE_URL = 'https://api.atlassian.com';

export interface ConfluenceLabelUpdateInput {
  pageId: string;
  currentLabels: string[];
  addLabels: string[];
  removeLabels: string[];
}

export interface ConfluenceLabelUpdateResult {
  pageId: string;
  labels: string[];
  addedLabels: string[];
  removedLabels: string[];
}

export interface ConfluencePageMoveInput {
  pageId: string;
  targetParentId: string;
}

export interface ConfluencePageMoveResult {
  pageId: string;
  targetParentId: string;
}

export interface ConfluencePageUpdateInput {
  pageId: string;
  title: string;
  bodyStorage: string;
  version: number;
  parentId?: string | null;
  spaceId?: string | null;
  message?: string;
}

export interface ConfluencePageUpdateResult {
  pageId: string;
  title: string;
  version: number;
  parentId: string | null;
  bodyStorage: string;
}

export interface ConfluenceArchiveInput {
  pageId: string;
}

export interface ConfluenceArchiveResult {
  pageId: string;
  taskId: string | null;
  statusUrl: string | null;
}

export class ConfluenceWriteError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, options?: { status?: number; code?: string; details?: unknown }) {
    super(message);
    this.name = 'ConfluenceWriteError';
    this.status = options?.status ?? 500;
    this.code = options?.code ?? 'CONFLUENCE_WRITE_FAILED';
    this.details = options?.details;
  }
}

export async function directUpdateConfluenceLabels(
  appUserKey: string,
  input: ConfluenceLabelUpdateInput
): Promise<ConfluenceLabelUpdateResult> {
  const connection = await getWritableConfluenceConnection(appUserKey);

  const pageId = input.pageId.trim();
  if (!pageId) {
    throw new ConfluenceWriteError('A Confluence page ID is required', {
      status: 400,
      code: 'CONFLUENCE_PAGE_ID_REQUIRED',
    });
  }

  const currentLabels = normalizeLabels(input.currentLabels);
  const addLabels = normalizeLabels(input.addLabels).filter((label) => !currentLabels.includes(label));
  const removeLabels = normalizeLabels(input.removeLabels).filter((label) => currentLabels.includes(label));

  if (addLabels.length > 0) {
    await confluenceRequest(connection, 'POST', `/wiki/rest/api/content/${encodeURIComponent(pageId)}/label`, {
      json: addLabels.map((label) => ({
        prefix: 'global',
        name: label,
      })),
    });
  }

  for (const label of removeLabels) {
    await confluenceRequest(
      connection,
      'DELETE',
      `/wiki/rest/api/content/${encodeURIComponent(pageId)}/label/${encodeURIComponent(label)}`
    );
  }

  const finalLabels = currentLabels.filter((label) => !removeLabels.includes(label));
  addLabels.forEach((label) => {
    if (!finalLabels.includes(label)) {
      finalLabels.push(label);
    }
  });

  return {
    pageId,
    labels: finalLabels,
    addedLabels: addLabels,
    removedLabels: removeLabels,
  };
}

export async function directMoveConfluencePage(
  appUserKey: string,
  input: ConfluencePageMoveInput
): Promise<ConfluencePageMoveResult> {
  const connection = await getWritableConfluenceConnection(appUserKey);
  const pageId = input.pageId.trim();
  const targetParentId = input.targetParentId.trim();

  if (!pageId || !targetParentId) {
    throw new ConfluenceWriteError('Both pageId and targetParentId are required', {
      status: 400,
      code: 'CONFLUENCE_MOVE_INVALID',
    });
  }

  await confluenceRequest(
    connection,
    'PUT',
    `/wiki/rest/api/content/${encodeURIComponent(pageId)}/move/append/${encodeURIComponent(targetParentId)}`
  );

  return {
    pageId,
    targetParentId,
  };
}

export async function directUpdateConfluencePage(
  appUserKey: string,
  input: ConfluencePageUpdateInput
): Promise<ConfluencePageUpdateResult> {
  const connection = await getWritableConfluenceConnection(appUserKey);
  const pageId = input.pageId.trim();

  if (!pageId) {
    throw new ConfluenceWriteError('A Confluence page ID is required', {
      status: 400,
      code: 'CONFLUENCE_PAGE_ID_REQUIRED',
    });
  }

  if (!Number.isFinite(input.version) || input.version < 1) {
    throw new ConfluenceWriteError('A valid Confluence page version is required', {
      status: 400,
      code: 'CONFLUENCE_VERSION_REQUIRED',
    });
  }

  const payload = {
    id: pageId,
    status: 'current',
    title: input.title,
    parentId: input.parentId ?? undefined,
    spaceId: input.spaceId ?? undefined,
    body: {
      representation: 'storage',
      value: input.bodyStorage,
    },
    version: {
      number: input.version + 1,
      message: input.message ?? 'Updated via Javis',
    },
  };

  const response = await confluenceRequest<Record<string, unknown>>(
    connection,
    'PUT',
    `/wiki/api/v2/pages/${encodeURIComponent(pageId)}`,
    { json: payload }
  );

  return {
    pageId,
    title: readString(response, ['title']) ?? input.title,
    version: readNestedNumber(response, ['version', 'number']) ?? input.version + 1,
    parentId: readString(response, ['parentId']) ?? input.parentId ?? null,
    bodyStorage: input.bodyStorage,
  };
}

export async function directArchiveConfluencePage(
  appUserKey: string,
  input: ConfluenceArchiveInput
): Promise<ConfluenceArchiveResult> {
  const connection = await getWritableConfluenceConnection(appUserKey);
  const pageId = input.pageId.trim();

  if (!pageId) {
    throw new ConfluenceWriteError('A Confluence page ID is required', {
      status: 400,
      code: 'CONFLUENCE_PAGE_ID_REQUIRED',
    });
  }

  const response = await confluenceRequest<Record<string, unknown>>(
    connection,
    'POST',
    '/wiki/rest/api/content/archive',
    {
      json: {
        pages: [{ id: Number(pageId) || pageId }],
      },
    }
  );

  const links = isObject(response.links) ? response.links : {};
  return {
    pageId,
    taskId: readString(response, ['id']),
    statusUrl: readString(links, ['status']),
  };
}

async function getWritableConfluenceConnection(appUserKey: string) {
  const connection = await getUsableAtlassianConnection(appUserKey);
  if (!connection) {
    throw new ConfluenceWriteError('Atlassian account is not connected for this user', {
      status: 409,
      code: 'ATLASSIAN_NOT_CONNECTED',
    });
  }

  if (!connection.capabilities.confluenceWrite) {
    throw new ConfluenceWriteError('Connected Atlassian account does not have Confluence write scope', {
      status: 403,
      code: 'CONFLUENCE_SCOPE_MISSING',
    });
  }

  if (!connection.site.id) {
    throw new ConfluenceWriteError('Connected Atlassian account is missing a selected Confluence cloud site', {
      status: 409,
      code: 'CONFLUENCE_SITE_UNRESOLVED',
    });
  }

  return connection;
}

async function confluenceRequest<T = unknown>(
  connection: NonNullable<Awaited<ReturnType<typeof getUsableAtlassianConnection>>>,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options?: {
    json?: unknown;
  }
): Promise<T> {
  const url = new URL(`${ATLASSIAN_API_BASE_URL}/ex/confluence/${connection.site.id}${path}`);

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
    throw new ConfluenceWriteError(readConfluenceErrorMessage(details, response.status), {
      status: response.status,
      code: 'CONFLUENCE_API_ERROR',
      details,
    });
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await safeJson(response)) as T;
}

function normalizeLabels(labels: string[]): string[] {
  return Array.from(
    new Set(
      labels
        .filter((label): label is string => typeof label === 'string')
        .map((label) => label.trim())
        .filter(Boolean)
    )
  );
}

function readConfluenceErrorMessage(payload: unknown, status: number): string {
  if (isObject(payload)) {
    const message = readString(payload, ['message', 'error', 'reason']);
    if (message) {
      return message;
    }

    if (Array.isArray(payload.errors) && payload.errors.length > 0) {
      const firstMessage = payload.errors.find(
        (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())
      );
      if (firstMessage) {
        return firstMessage;
      }
    }

    if (isObject(payload.data)) {
      const dataMessage = readString(payload.data, ['message']);
      if (dataMessage) {
        return dataMessage;
      }
    }
  }

  return `Confluence API request failed (${status})`;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

function readNestedNumber(source: Record<string, unknown>, path: string[]): number | null {
  let current: unknown = source;

  for (const key of path) {
    if (!isObject(current)) {
      return null;
    }
    current = current[key];
  }

  return typeof current === 'number' && Number.isFinite(current) ? current : null;
}
