import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  verifySlackSignature,
  parseSlackFormData,
  buildStatusMessage,
  buildRiskListMessage,
  buildSearchResultsMessage,
  buildHelpMessage,
  buildErrorMessage,
  ephemeralResponse,
  inChannelResponse,
} from '@/lib/slack';
import type { SlackSlashCommand, SlackCommandResponse } from '@/types/slack';

/**
 * POST /api/slack/commands - Handle /jarvis slash commands
 *
 * Slack requires a response within 3 seconds. For longer operations,
 * we acknowledge immediately and use the response_url for deferred responses.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify Slack signature
  const signature = request.headers.get('x-slack-signature') || '';
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';

  if (!verifySlackSignature(signature, timestamp, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse command data
  const data = parseSlackFormData(rawBody) as unknown as SlackSlashCommand;
  const commandText = (data.text || '').trim().toLowerCase();
  const args = commandText.split(/\s+/);
  const subcommand = args[0] || 'help';
  const subargs = args.slice(1);

  console.log(`Slack command: /jarvis ${commandText} from ${data.user_name}`);

  // Handle commands
  try {
    switch (subcommand) {
      case 'status':
        return handleStatusCommand(data);

      case 'search':
        return handleSearchCommand(data, subargs.join(' '));

      case 'risk':
      case 'risks':
        return handleRiskCommand(data);

      case 'help':
      default:
        return NextResponse.json(ephemeralResponse('Jarvis Help', buildHelpMessage()));
    }
  } catch (error) {
    console.error('Slack command error:', error);
    return NextResponse.json(
      ephemeralResponse('Error', buildErrorMessage('An error occurred processing your command.'))
    );
  }
}

/**
 * Handle /jarvis status - Show current sprint status
 */
async function handleStatusCommand(_data: SlackSlashCommand): Promise<NextResponse<SlackCommandResponse>> {
  const client = await pool.connect();

  try {
    // Get active sprint
    const sprintResult = await client.query(`
      SELECT * FROM jira_sprints
      WHERE state = 'active'
      ORDER BY start_date DESC
      LIMIT 1
    `);

    if (sprintResult.rows.length === 0) {
      return NextResponse.json(
        ephemeralResponse('No active sprint found.')
      );
    }

    const sprint = sprintResult.rows[0];

    // Get issue counts
    const issuesResult = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE raw_data->'fields'->'status'->>'name' IN ('Done', 'Closed', 'Resolved', 'Complete', 'Completed')) as done,
        COUNT(*) FILTER (WHERE raw_data->'fields'->'status'->>'name' IN ('In Progress', 'In Review', 'Testing')) as in_progress
      FROM jira_issues
      WHERE $1 = ANY(
        SELECT (s->>'id')::text
        FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'sprints', '[]')) s
      )
         OR raw_data->'fields'->'sprint'->>'id' = $1
    `, [String(sprint.id)]);

    const stats = issuesResult.rows[0];
    const total = parseInt(stats.total) || 0;
    const done = parseInt(stats.done) || 0;
    const inProgress = parseInt(stats.in_progress) || 0;
    const todo = total - done - inProgress;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const blocks = buildStatusMessage({
      sprintName: sprint.name,
      progress,
      done,
      inProgress,
      todo,
      total,
    });

    return NextResponse.json(inChannelResponse(`Sprint Status: ${sprint.name}`, blocks));
  } finally {
    client.release();
  }
}

/**
 * Handle /jarvis search <query> - Search Jira issues
 */
async function handleSearchCommand(
  data: SlackSlashCommand,
  query: string
): Promise<NextResponse<SlackCommandResponse>> {
  if (!query) {
    return NextResponse.json(
      ephemeralResponse('Usage: `/jarvis search <query>`')
    );
  }

  const client = await pool.connect();

  try {
    // Full-text search across key and summary
    const result = await client.query(`
      SELECT
        key,
        raw_data->'fields'->>'summary' as summary,
        raw_data->'fields'->'status'->>'name' as status,
        raw_data->'fields'->'assignee'->>'displayName' as assignee
      FROM jira_issues
      WHERE
        key ILIKE $1
        OR raw_data->'fields'->>'summary' ILIKE $1
        OR raw_data->'fields'->>'description' ILIKE $1
      ORDER BY
        CASE WHEN key ILIKE $1 THEN 0 ELSE 1 END,
        raw_data->'fields'->'updated' DESC
      LIMIT 15
    `, [`%${query}%`]);

    const blocks = buildSearchResultsMessage(query, result.rows);

    return NextResponse.json(ephemeralResponse(`Search: ${query}`, blocks));
  } finally {
    client.release();
  }
}

/**
 * Handle /jarvis risk - Show current open risks
 */
async function handleRiskCommand(_data: SlackSlashCommand): Promise<NextResponse<SlackCommandResponse>> {
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        r.id,
        r.severity,
        r.title,
        r.risk_type,
        m.title as milestone_title
      FROM roadmap_risks r
      LEFT JOIN roadmap_milestones m ON r.milestone_id = m.id
      WHERE r.status = 'open'
      ORDER BY
        CASE r.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
      LIMIT 15
    `);

    if (result.rows.length === 0) {
      return NextResponse.json(
        ephemeralResponse(':white_check_mark: No open risks found!')
      );
    }

    const blocks = buildRiskListMessage(result.rows);

    return NextResponse.json(inChannelResponse(`${result.rows.length} open risks`, blocks));
  } finally {
    client.release();
  }
}
