import pool from '@/lib/db';
import { adfToText } from '@/lib/adf-parser';
import type { ServiceDeskResponse, ServiceDeskStats, ServiceDeskFilterOptions, ServiceDeskTicket, BusinessUnit } from '@/types/service-desk';
import { BUSINESS_UNIT_COMPONENTS } from '@/types/service-desk';

// Centralized status definitions
export const RESOLVED_STATUSES = ['DONE', 'CLOSED', 'RESOLVED', 'COMPLETE', 'COMPLETED', 'NOT REQUIRED'];
export const IN_PROGRESS_STATUSES = ['IN PROGRESS', 'IN STAGING', 'IN REVIEW', 'TESTING'];

// Statuses to hide after 1 month
const HIDE_OLD_STATUSES = ['DONE', 'CLOSED', 'COMPLETED', 'NOT REQUIRED'];

// SQL condition to hide old resolved tickets (older than 1 month)
const HIDE_OLD_TICKETS_CONDITION = `
  NOT (
    UPPER(status) IN (${HIDE_OLD_STATUSES.map(s => `'${s}'`).join(',')})
    AND COALESCE(
      (raw_data->'fields'->>'resolutiondate')::timestamp,
      updated_at
    ) < NOW() - INTERVAL '1 month'
  )
`;

function getComponentsForBusinessUnit(businessUnit: BusinessUnit): string[] | null {
  if (businessUnit === 'all') return null;
  return BUSINESS_UNIT_COMPONENTS[businessUnit] || null;
}

export interface ServiceDeskQueryParams {
  businessUnit?: BusinessUnit;
  status?: string;
  assignee?: string;
  priority?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface ServiceDeskDataResult extends ServiceDeskResponse {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalCount: number;
  };
  tabCounts: Record<BusinessUnit, number>;
}

export async function getServiceDeskData(params: ServiceDeskQueryParams = {}): Promise<ServiceDeskDataResult> {
  const {
    businessUnit = 'all',
    status,
    assignee,
    priority,
    search,
    page = 1,
    pageSize = 50,
  } = params;

  // Build base conditions for business unit
  const buildConditions = (bu: BusinessUnit) => {
    const conditions: string[] = [
      "project = 'PSSM'",
      HIDE_OLD_TICKETS_CONDITION,
    ];
    const values: (string | string[])[] = [];
    let paramIndex = 1;

    const buComponents = getComponentsForBusinessUnit(bu);
    if (buComponents) {
      conditions.push(`EXISTS (
        SELECT 1 FROM jsonb_array_elements(raw_data->'fields'->'components') AS comp
        WHERE comp->>'name' = ANY($${paramIndex++})
      )`);
      values.push(buComponents);
    }

    return { conditions, values, paramIndex };
  };

  // Build main query conditions
  const { conditions, values, paramIndex: startParamIndex } = buildConditions(businessUnit);
  let paramIndex = startParamIndex;

  if (status) {
    const statuses = status.split(',').map(s => s.trim().toUpperCase());
    conditions.push(`UPPER(status) = ANY($${paramIndex++})`);
    values.push(statuses);
  }

  if (assignee) {
    const assignees = assignee.split(',').map(a => a.trim());
    conditions.push(`raw_data->'fields'->'assignee'->>'accountId' = ANY($${paramIndex++})`);
    values.push(assignees);
  }

  if (priority) {
    const priorities = priority.split(',').map(p => p.trim());
    conditions.push(`raw_data->'fields'->'priority'->>'name' = ANY($${paramIndex++})`);
    values.push(priorities);
  }

  if (search) {
    conditions.push(`(key ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
    values.push(`%${search}%`);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * pageSize;

  // Prepare tickets query params (extends base values with pagination)
  const ticketsValues = [...values, pageSize.toString(), offset.toString()];
  const limitParamIndex = paramIndex;
  const offsetParamIndex = paramIndex + 1;

  // Run all queries in parallel using Promise.all with pool.query for true parallelism
  // Each query gets its own connection from the pool, enabling concurrent execution
  const [
    tabCountsResult,
    statsResult,
    statusBreakdownResult,
    componentBreakdownResult,
    ticketsResult,
    filterOptionsResult,
  ] = await Promise.all([
    // Tab counts (independent)
    pool.query(`
      WITH ticket_components AS (
        SELECT
          key,
          status,
          COALESCE(
            (SELECT jsonb_agg(comp->>'name') FROM jsonb_array_elements(raw_data->'fields'->'components') AS comp),
            '[]'::jsonb
          ) as components
        FROM jira_issues
        WHERE project = 'PSSM'
          AND ${HIDE_OLD_TICKETS_CONDITION}
      )
      SELECT
        COUNT(*) as all_count,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(components) AS c
          WHERE c::text = ANY(ARRAY[${BUSINESS_UNIT_COMPONENTS['integrated-systems'].map(c => `'"${c}"'`).join(',')}])
        )) as is_count,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(components) AS c
          WHERE c::text = ANY(ARRAY[${BUSINESS_UNIT_COMPONENTS['abatement'].map(c => `'"${c}"'`).join(',')}])
        )) as ab_count
      FROM ticket_components
    `),

    // Stats query
    pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE UPPER(status) NOT IN (${RESOLVED_STATUSES.map(s => `'${s}'`).join(',')})
          AND UPPER(status) NOT IN (${IN_PROGRESS_STATUSES.map(s => `'${s}'`).join(',')})) as open,
        COUNT(*) FILTER (WHERE UPPER(status) IN (${IN_PROGRESS_STATUSES.map(s => `'${s}'`).join(',')})) as in_progress,
        COUNT(*) FILTER (WHERE UPPER(status) IN (${RESOLVED_STATUSES.map(s => `'${s}'`).join(',')})) as resolved
      FROM jira_issues
      ${whereClause}
    `, values),

    // Status breakdown
    pool.query(`
      SELECT status, COUNT(*) as count
      FROM jira_issues
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `, values),

    // Component breakdown
    pool.query(`
      SELECT comp->>'name' as component, COUNT(*) as count
      FROM jira_issues, jsonb_array_elements(raw_data->'fields'->'components') AS comp
      ${whereClause}
      GROUP BY comp->>'name'
      ORDER BY count DESC
      LIMIT 10
    `, values),

    // Paginated tickets
    pool.query(`
      SELECT
        key,
        summary,
        status,
        raw_data->'fields'->'priority'->>'name' as priority,
        raw_data->'fields'->'reporter'->>'accountId' as reporter,
        raw_data->'fields'->'reporter'->>'displayName' as reporter_display_name,
        raw_data->'fields'->'assignee'->>'accountId' as assignee,
        raw_data->'fields'->'assignee'->>'displayName' as assignee_display_name,
        (
          SELECT COALESCE(jsonb_agg(comp->>'name'), '[]'::jsonb)
          FROM jsonb_array_elements(raw_data->'fields'->'components') AS comp
        ) as components,
        raw_data->'fields'->'description' as description,
        raw_data->'fields'->'comment'->'comments' as comments,
        created_at,
        updated_at,
        raw_data->'fields'->>'resolutiondate' as resolved_at
      FROM jira_issues
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `, ticketsValues),

    // Filter options (independent)
    pool.query(`
      SELECT DISTINCT
        status,
        raw_data->'fields'->'assignee'->>'accountId' as assignee_id,
        raw_data->'fields'->'assignee'->>'displayName' as assignee_name,
        raw_data->'fields'->'priority'->>'name' as priority
      FROM jira_issues
      WHERE project = 'PSSM'
    `),
  ]);

  // Process tab counts
  const tabCounts: Record<BusinessUnit, number> = {
    all: parseInt(tabCountsResult.rows[0].all_count) || 0,
    'integrated-systems': parseInt(tabCountsResult.rows[0].is_count) || 0,
    abatement: parseInt(tabCountsResult.rows[0].ab_count) || 0,
  };

  // Process stats
  const statsRow = statsResult.rows[0];
  const total = parseInt(statsRow.total) || 0;
  const open = parseInt(statsRow.open) || 0;
  const inProgress = parseInt(statsRow.in_progress) || 0;
  const resolved = parseInt(statsRow.resolved) || 0;
  const resolvedPercent = total > 0 ? Math.round((resolved / total) * 100) : 0;

  // Process breakdowns
  const byStatus = statusBreakdownResult.rows.map(r => ({
    status: r.status,
    count: parseInt(r.count),
  }));

  const byComponent = componentBreakdownResult.rows.map(r => ({
    component: r.component,
    count: parseInt(r.count),
  }));

  // Process tickets
  const tickets: ServiceDeskTicket[] = ticketsResult.rows.map(row => {
    const rawComments = row.comments || [];
    const comments = Array.isArray(rawComments)
      ? rawComments.map((c: { id?: string; author?: { accountId?: string; displayName?: string }; body?: unknown; created?: string }) => ({
          id: c.id || '',
          author: c.author?.accountId || '',
          author_display_name: c.author?.displayName || 'Unknown',
          body: adfToText(c.body),
          created: c.created || '',
        }))
      : [];

    const description = adfToText(row.description);

    return {
      key: row.key,
      summary: row.summary,
      status: row.status,
      priority: row.priority,
      reporter: row.reporter,
      reporter_display_name: row.reporter_display_name,
      assignee: row.assignee,
      assignee_display_name: row.assignee_display_name,
      components: row.components || [],
      description,
      comments,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
    };
  });

  // Process filter options
  const statuses = [...new Set(filterOptionsResult.rows.map(r => r.status))].filter(Boolean).sort();
  const assigneesMap = new Map<string, string>();
  filterOptionsResult.rows.forEach(r => {
    if (r.assignee_id && r.assignee_name) {
      assigneesMap.set(r.assignee_id, r.assignee_name);
    }
  });
  const assignees = Array.from(assigneesMap.entries())
    .map(([accountId, displayName]) => ({ accountId, displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
  const priorities = [...new Set(filterOptionsResult.rows.map(r => r.priority))].filter(Boolean);

  const stats: ServiceDeskStats = {
    total,
    open,
    inProgress,
    resolved,
    resolvedPercent,
    byStatus,
    byComponent,
  };

  const filterOptions: ServiceDeskFilterOptions = {
    statuses,
    assignees,
    priorities,
  };

  return {
    tickets,
    stats,
    filterOptions,
    pagination: {
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      totalCount: total,
    },
    tabCounts,
  };
}

// Simple stats for home page
export async function getServiceDeskStats(): Promise<{ total: number; open: number }> {
  const result = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE UPPER(status) NOT IN (${RESOLVED_STATUSES.map(s => `'${s}'`).join(',')})) as open
    FROM jira_issues
    WHERE project = 'PSSM'
      AND ${HIDE_OLD_TICKETS_CONDITION}
  `);
  return {
    total: parseInt(result.rows[0].total) || 0,
    open: parseInt(result.rows[0].open) || 0,
  };
}
