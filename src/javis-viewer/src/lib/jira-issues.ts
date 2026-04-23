import pool from "@/lib/db";
import type {
  FilterOption,
  JiraIssueFilterOptions,
  JiraIssueListItem,
  JiraIssueListResponse,
  JiraIssueQueryState,
} from "@/types/jira-list";
import { DEFAULT_JIRA_ISSUE_PAGE_SIZE } from "@/types/jira-list";

const MAX_JIRA_ISSUE_PAGE_SIZE = 100;

interface WhereClauseResult {
  whereClause: string;
  values: unknown[];
}

function normalizeTextArray(values: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}

function toSortedOptions(rows: Array<{ label: string | null; count: number | string }>): FilterOption[] {
  return rows
    .filter((row) => row.label && row.label.trim().length > 0)
    .map((row) => ({
      label: row.label!.trim(),
      count: Number(row.count),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function normalizeJiraIssueQueryState(input: Partial<JiraIssueQueryState>): JiraIssueQueryState {
  const limit = Number.isFinite(input.limit)
    ? Math.min(Math.max(Math.trunc(input.limit as number), 1), MAX_JIRA_ISSUE_PAGE_SIZE)
    : DEFAULT_JIRA_ISSUE_PAGE_SIZE;
  const page = Number.isFinite(input.page) ? Math.max(Math.trunc(input.page as number), 1) : 1;

  return {
    page,
    limit,
    search: input.search?.trim() ?? "",
    projects: normalizeTextArray(input.projects ?? []),
    components: normalizeTextArray(input.components ?? []),
    assignees: normalizeTextArray(input.assignees ?? []),
    reporters: normalizeTextArray(input.reporters ?? []),
  };
}

// Labels and component names that belong to other portals — always excluded from this view.
const EXCLUDED_SYSTEM_NAMES = ['eob', 'oqc'];

function buildWhereClause(query: JiraIssueQueryState): WhereClauseResult {
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  // Permanent exclusion: hide EOB/OQC component tickets
  conditions.push(`
    NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS comp
      WHERE LOWER(comp->>'name') = ANY($${paramIndex}::text[])
    )
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(raw_data->'fields'->'labels', '[]'::jsonb)) AS lbl
      WHERE LOWER(lbl) = ANY($${paramIndex}::text[])
    )
  `);
  values.push(EXCLUDED_SYSTEM_NAMES);
  paramIndex += 1;

  if (query.search) {
    const searchPattern = `%${escapeIlike(query.search)}%`;
    conditions.push(`(key ILIKE $${paramIndex} ESCAPE '\\' OR summary ILIKE $${paramIndex} ESCAPE '\\')`);
    values.push(searchPattern);
    paramIndex += 1;
  }

  if (query.projects.length > 0) {
    conditions.push(`project = ANY($${paramIndex}::text[])`);
    values.push(query.projects);
    paramIndex += 1;
  }

  if (query.components.length > 0) {
    conditions.push(`
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS component
        WHERE component->>'name' = ANY($${paramIndex}::text[])
      )
    `);
    values.push(query.components);
    paramIndex += 1;
  }

  if (query.assignees.length > 0) {
    conditions.push(`
      COALESCE(NULLIF(TRIM(raw_data->'fields'->'assignee'->>'displayName'), ''), 'Unassigned')
      = ANY($${paramIndex}::text[])
    `);
    values.push(query.assignees);
    paramIndex += 1;
  }

  if (query.reporters.length > 0) {
    conditions.push(`
      COALESCE(NULLIF(TRIM(raw_data->'fields'->'reporter'->>'displayName'), ''), 'Unknown reporter')
      = ANY($${paramIndex}::text[])
    `);
    values.push(query.reporters);
  }

  return {
    whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    values,
  };
}

export async function getJiraIssuePage(input: Partial<JiraIssueQueryState>): Promise<JiraIssueListResponse> {
  const query = normalizeJiraIssueQueryState(input);
  const { whereClause, values } = buildWhereClause(query);
  const countResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::int AS total FROM jira_issues ${whereClause}`,
    values
  );

  const total = Number(countResult.rows[0]?.total ?? 0);
  const totalPages = total === 0 ? 1 : Math.ceil(total / query.limit);
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.limit;

  const itemsResult = await pool.query<JiraIssueListItem>(
    `
      SELECT
        key,
        summary,
        status,
        project,
        created_at,
        COALESCE(raw_data->'fields'->'components', '[]'::jsonb) AS components,
        raw_data->'fields'->'assignee'->>'displayName' AS assignee,
        raw_data->'fields'->'reporter'->>'displayName' AS reporter
      FROM jira_issues
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
    `,
    [...values, query.limit, offset]
  );

  return {
    items: itemsResult.rows,
    total,
    page,
    limit: query.limit,
  };
}

export async function getJiraIssueFilterOptions(): Promise<JiraIssueFilterOptions> {
  const excludedNames = EXCLUDED_SYSTEM_NAMES;
  const [projectsResult, componentsResult, assigneesResult, reportersResult] = await Promise.all([
    pool.query<{ label: string | null; count: string }>(`
      SELECT project AS label, COUNT(*)::int AS count
      FROM jira_issues
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS comp
        WHERE LOWER(comp->>'name') = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(raw_data->'fields'->'labels', '[]'::jsonb)) AS lbl
        WHERE LOWER(lbl) = ANY($1::text[])
      )
      GROUP BY project
      ORDER BY project ASC
    `, [excludedNames]),
    pool.query<{ label: string | null; count: string }>(`
      SELECT component->>'name' AS label, COUNT(*)::int AS count
      FROM jira_issues,
           jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS component
      WHERE component->>'name' IS NOT NULL
        AND component->>'name' != ''
        AND LOWER(component->>'name') != ALL($1::text[])
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(COALESCE(raw_data->'fields'->'labels', '[]'::jsonb)) AS lbl
          WHERE LOWER(lbl) = ANY($1::text[])
        )
      GROUP BY 1
      ORDER BY 1 ASC
    `, [excludedNames]),
    pool.query<{ label: string | null; count: string }>(`
      SELECT
        COALESCE(NULLIF(TRIM(raw_data->'fields'->'assignee'->>'displayName'), ''), 'Unassigned') AS label,
        COUNT(*)::int AS count
      FROM jira_issues
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS comp
        WHERE LOWER(comp->>'name') = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(raw_data->'fields'->'labels', '[]'::jsonb)) AS lbl
        WHERE LOWER(lbl) = ANY($1::text[])
      )
      GROUP BY 1
      ORDER BY 1 ASC
    `, [excludedNames]),
    pool.query<{ label: string | null; count: string }>(`
      SELECT
        COALESCE(NULLIF(TRIM(raw_data->'fields'->'reporter'->>'displayName'), ''), 'Unknown reporter') AS label,
        COUNT(*)::int AS count
      FROM jira_issues
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'components', '[]'::jsonb)) AS comp
        WHERE LOWER(comp->>'name') = ANY($1::text[])
      )
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(raw_data->'fields'->'labels', '[]'::jsonb)) AS lbl
        WHERE LOWER(lbl) = ANY($1::text[])
      )
      GROUP BY 1
      ORDER BY 1 ASC
    `, [excludedNames]),
  ]);

  return {
    projects: toSortedOptions(projectsResult.rows),
    components: toSortedOptions(componentsResult.rows),
    assignees: toSortedOptions(assigneesResult.rows),
    reporters: toSortedOptions(reportersResult.rows),
  };
}
