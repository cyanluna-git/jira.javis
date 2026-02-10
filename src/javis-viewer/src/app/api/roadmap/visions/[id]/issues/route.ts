import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { EpicWithIssues, EpicStats, IssueBasic, VisionIssuesResponse } from '@/types/roadmap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/visions/[id]/issues - Get Epic -> Issue hierarchy for a Vision
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    // Step 1: Get Vision with jql_filter and project_key
    const visionResult = await client.query(`
      SELECT id, project_key, jql_filter FROM roadmap_visions WHERE id = $1
    `, [id]);

    if (visionResult.rows.length === 0) {
      return NextResponse.json({ error: 'Vision not found' }, { status: 404 });
    }

    const vision = visionResult.rows[0];
    const projectKey = vision.project_key;
    const jqlFilter = vision.jql_filter as string | null;

    // Parse component from jql_filter (e.g., 'component = "Unify"' or 'component in ("A", "B")')
    const parseComponentsFromJql = (jql: string | null): string[] => {
      if (!jql) return [];

      // Match: component = "Name" or component = 'Name'
      const singleMatch = jql.match(/component\s*=\s*["']([^"']+)["']/i);
      if (singleMatch) {
        return [singleMatch[1]];
      }

      // Match: component in ("A", "B", "C")
      const inMatch = jql.match(/component\s+in\s*\(([^)]+)\)/i);
      if (inMatch) {
        const components = inMatch[1].match(/["']([^"']+)["']/g);
        if (components) {
          return components.map(c => c.replace(/["']/g, ''));
        }
      }

      return [];
    };

    const componentFilter = parseComponentsFromJql(jqlFilter);

    // Step 2: Get all linked Epic keys with their Milestone info
    const linkedEpicsResult = await client.query(`
      SELECT
        el.epic_key,
        el.milestone_id,
        m.title as milestone_title,
        ji.summary as epic_summary,
        ji.raw_data->'fields'->'status'->>'name' as epic_status
      FROM roadmap_milestones m
      JOIN roadmap_epic_links el ON el.milestone_id = m.id
      LEFT JOIN jira_issues ji ON ji.key = el.epic_key
      WHERE m.vision_id = $1
      ORDER BY m.quarter, m.title, el.epic_key
    `, [id]);

    const linkedEpicKeys = linkedEpicsResult.rows.map(r => r.epic_key);

    // Step 3: Get all Epics in the project that are NOT linked (with component filter from jql_filter)
    const unlinkedEpicsResult = await client.query(`
      SELECT
        key,
        summary,
        raw_data->'fields'->'status'->>'name' as status
      FROM jira_issues
      WHERE project = $1
        AND raw_data->'fields'->'issuetype'->>'name' = 'Epic'
        AND ($2::text[] IS NULL OR key != ALL($2))
        AND (
          $3::text[] IS NULL
          OR $3::text[] = '{}'
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(raw_data->'fields'->'components') AS comp
            WHERE comp->>'name' = ANY($3)
          )
        )
      ORDER BY key
    `, [projectKey, linkedEpicKeys.length > 0 ? linkedEpicKeys : null, componentFilter]);

    // Step 4: Get all child Issues for all Epics (single bulk query)
    const allEpicKeys = [
      ...linkedEpicKeys,
      ...unlinkedEpicsResult.rows.map(r => r.key)
    ];

    const childIssuesMap: Map<string, IssueBasic[]> = new Map();

    if (allEpicKeys.length > 0) {
      const childIssuesResult = await client.query(`
        SELECT
          raw_data->'fields'->'parent'->>'key' as parent_key,
          key,
          summary,
          raw_data->'fields'->'status'->>'name' as status,
          raw_data->'fields'->'issuetype'->>'name' as type,
          raw_data->'fields'->'assignee'->>'displayName' as assignee
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = ANY($1)
        ORDER BY key
      `, [allEpicKeys]);

      // Group by parent Epic
      for (const row of childIssuesResult.rows) {
        const parentKey = row.parent_key;
        if (!childIssuesMap.has(parentKey)) {
          childIssuesMap.set(parentKey, []);
        }
        childIssuesMap.get(parentKey)!.push({
          key: row.key,
          summary: row.summary,
          status: row.status || 'Unknown',
          type: row.type || 'Task',
          assignee: row.assignee || undefined,
        });
      }
    }

    // Helper function to calculate stats
    const calculateStats = (issues: IssueBasic[]): EpicStats => {
      const total = issues.length;
      const done = issues.filter(i =>
        i.status === 'Done' || i.status === 'Closed' || i.status === 'Resolved'
      ).length;
      const inProgress = issues.filter(i =>
        i.status === 'In Progress' || i.status === 'In Review'
      ).length;
      const todo = total - done - inProgress;
      const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0;

      return { total, done, in_progress: inProgress, todo, progress_percent: progressPercent };
    };

    // Step 5: Build linked_epics response
    const linkedEpics: EpicWithIssues[] = linkedEpicsResult.rows.map(row => {
      const issues = childIssuesMap.get(row.epic_key) || [];
      return {
        key: row.epic_key,
        summary: row.epic_summary || row.epic_key,
        status: row.epic_status || 'Unknown',
        milestone_id: row.milestone_id,
        milestone_title: row.milestone_title,
        issues,
        stats: calculateStats(issues),
      };
    });

    // Step 6: Build unlinked_epics response
    const unlinkedEpics: EpicWithIssues[] = unlinkedEpicsResult.rows.map(row => {
      const issues = childIssuesMap.get(row.key) || [];
      return {
        key: row.key,
        summary: row.summary || row.key,
        status: row.status || 'Unknown',
        issues,
        stats: calculateStats(issues),
      };
    });

    const response: VisionIssuesResponse = {
      linked_epics: linkedEpics,
      unlinked_epics: unlinkedEpics,
      jql_filter: vision.jql_filter,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching vision issues:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vision issues' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
