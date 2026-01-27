import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

// Jira API configuration
const JIRA_URL = process.env.JIRA_URL;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_TOKEN = process.env.JIRA_TOKEN;

// Status categories
const DONE_STATUSES = new Set(['Done', 'Closed', 'Resolved', 'Complete', 'Completed']);
const IN_PROGRESS_STATUSES = new Set(['In Progress', 'In Review', 'Testing', 'In Development']);

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    assignee?: { displayName: string } | null;
  };
}

interface EpicProgress {
  epic_key: string;
  total: number;
  done: number;
  in_progress: number;
  todo: number;
  progress_percent: number;
  issues: Array<{ key: string; summary: string; status: string }>;
}

async function fetchEpicChildren(epicKey: string): Promise<JiraIssue[]> {
  if (!JIRA_URL || !JIRA_EMAIL || !JIRA_TOKEN) {
    console.warn('Jira credentials not configured');
    return [];
  }

  // JQL to find issues under this Epic (Next-gen project style)
  const jql = `parent = ${epicKey}`;
  const url = `${JIRA_URL}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=key,summary,status,issuetype,assignee&maxResults=100`;

  const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_TOKEN}`).toString('base64');

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Jira API error: ${response.status}`);
    }

    const data = await response.json();
    return data.issues || [];
  } catch (error) {
    console.error(`Error fetching Epic ${epicKey} children:`, error);
    return [];
  }
}

function calculateProgress(issues: JiraIssue[]): Omit<EpicProgress, 'epic_key'> {
  if (issues.length === 0) {
    return {
      total: 0,
      done: 0,
      in_progress: 0,
      todo: 0,
      progress_percent: 0,
      issues: [],
    };
  }

  let done = 0;
  let inProgress = 0;
  let todo = 0;

  const issueSummary = issues.map(issue => {
    const statusName = issue.fields.status.name;

    if (DONE_STATUSES.has(statusName)) {
      done++;
    } else if (IN_PROGRESS_STATUSES.has(statusName)) {
      inProgress++;
    } else {
      todo++;
    }

    return {
      key: issue.key,
      summary: issue.fields.summary,
      status: statusName,
    };
  });

  // Calculate progress: done = 100%, in_progress = 50%
  const progressPercent = ((done * 100) + (inProgress * 50)) / issues.length;

  return {
    total: issues.length,
    done,
    in_progress: inProgress,
    todo,
    progress_percent: Math.round(progressPercent * 100) / 100,
    issues: issueSummary,
  };
}

// POST /api/roadmap/sync - Trigger sync for all or specific milestone
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json().catch(() => ({}));
    const milestoneId = body.milestone_id;

    // Get epic links
    let query = `
      SELECT
        el.id, el.milestone_id, el.stream_id, el.epic_key,
        m.title as milestone_title
      FROM roadmap_epic_links el
      JOIN roadmap_milestones m ON m.id = el.milestone_id
    `;
    const params: string[] = [];

    if (milestoneId) {
      query += ' WHERE el.milestone_id = $1';
      params.push(milestoneId);
    }

    const epicLinksResult = await client.query(query, params);
    const epicLinks = epicLinksResult.rows;

    if (epicLinks.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No epic links found',
        synced: 0,
      });
    }

    const results: EpicProgress[] = [];
    const milestonesToUpdate = new Set<string>();

    // Sync each epic
    for (const link of epicLinks) {
      const children = await fetchEpicChildren(link.epic_key);
      const progress = calculateProgress(children);

      results.push({
        epic_key: link.epic_key,
        ...progress,
      });

      // Update stream progress if linked
      if (link.stream_id) {
        await client.query(
          'UPDATE roadmap_streams SET progress_percent = $1 WHERE id = $2',
          [progress.progress_percent, link.stream_id]
        );
      }

      // Update sync timestamp
      await client.query(
        'UPDATE roadmap_epic_links SET last_synced_at = NOW() WHERE id = $1',
        [link.id]
      );

      milestonesToUpdate.add(link.milestone_id);
    }

    // Update milestone progress (average of streams or direct epic progress)
    for (const msId of milestonesToUpdate) {
      // Calculate average from streams
      const streamResult = await client.query(
        'SELECT COALESCE(AVG(progress_percent), 0) as avg FROM roadmap_streams WHERE milestone_id = $1',
        [msId]
      );
      const streamProgress = parseFloat(streamResult.rows[0].avg) || 0;

      // If no streams with progress, calculate from epic results
      let finalProgress = streamProgress;
      if (streamProgress === 0) {
        const msEpics = results.filter(r =>
          epicLinks.find(el => el.epic_key === r.epic_key && el.milestone_id === msId)
        );
        if (msEpics.length > 0) {
          finalProgress = msEpics.reduce((sum, e) => sum + e.progress_percent, 0) / msEpics.length;
        }
      }

      await client.query(
        'UPDATE roadmap_milestones SET progress_percent = $1 WHERE id = $2',
        [finalProgress, msId]
      );
    }

    return NextResponse.json({
      success: true,
      synced: epicLinks.length,
      milestones_updated: milestonesToUpdate.size,
      results,
    });
  } catch (error) {
    console.error('Error syncing epics:', error);
    return NextResponse.json(
      { error: 'Failed to sync epics' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET /api/roadmap/sync/[epicKey] - Get Epic progress without saving
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const epicKey = searchParams.get('epic_key');

  if (!epicKey) {
    return NextResponse.json(
      { error: 'epic_key parameter is required' },
      { status: 400 }
    );
  }

  try {
    const children = await fetchEpicChildren(epicKey);
    const progress = calculateProgress(children);

    return NextResponse.json({
      epic_key: epicKey,
      ...progress,
    });
  } catch (error) {
    console.error('Error fetching epic progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epic progress' },
      { status: 500 }
    );
  }
}
