import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import {
  verifySlackSignature,
  sendDeferredResponse,
  sectionBlock,
  contextBlock,
  ephemeralResponse,
} from '@/lib/slack';
import type { SlackInteractionPayload, SlackCommandResponse } from '@/types/slack';

/**
 * POST /api/slack/interactivity - Handle button clicks and other interactions
 *
 * Slack sends interactions as form data with a 'payload' field containing JSON.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify Slack signature
  const signature = request.headers.get('x-slack-signature') || '';
  const timestamp = request.headers.get('x-slack-request-timestamp') || '';

  if (!verifySlackSignature(signature, timestamp, rawBody)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Parse the payload
  const formData = new URLSearchParams(rawBody);
  const payloadStr = formData.get('payload');

  if (!payloadStr) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
  }

  let payload: SlackInteractionPayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  console.log(`Slack interaction: ${payload.type} from ${payload.user.username}`);

  // Handle different interaction types
  try {
    switch (payload.type) {
      case 'block_actions':
        return handleBlockActions(payload);

      default:
        // Acknowledge unknown interactions
        return new NextResponse(null, { status: 200 });
    }
  } catch (error) {
    console.error('Slack interaction error:', error);

    // Send error response via response_url
    if (payload.response_url) {
      await sendDeferredResponse(payload.response_url, {
        response_type: 'ephemeral',
        text: 'An error occurred processing your interaction.',
      });
    }

    return new NextResponse(null, { status: 200 });
  }
}

/**
 * Handle block_actions (button clicks, select changes, etc.)
 */
async function handleBlockActions(payload: SlackInteractionPayload): Promise<NextResponse> {
  const actions = payload.actions || [];

  for (const action of actions) {
    switch (action.action_id) {
      case 'view_risk_details':
        await handleViewRiskDetails(payload, action.value);
        break;

      case 'acknowledge_risk':
        await handleAcknowledgeRisk(payload, action.value);
        break;

      case 'view_sprint':
        await handleViewSprint(payload, action.value);
        break;

      default:
        console.log(`Unknown action: ${action.action_id}`);
    }
  }

  // Acknowledge the interaction
  return new NextResponse(null, { status: 200 });
}

/**
 * Handle "View Details" button click for risk
 */
async function handleViewRiskDetails(
  payload: SlackInteractionPayload,
  value: string | undefined
): Promise<void> {
  if (!value || !payload.response_url) return;

  const riskId = value.replace('risk_', '');
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        r.*,
        m.title as milestone_title,
        v.title as vision_title
      FROM roadmap_risks r
      LEFT JOIN roadmap_milestones m ON r.milestone_id = m.id
      LEFT JOIN roadmap_visions v ON m.vision_id = v.id
      WHERE r.id = $1
    `, [riskId]);

    if (result.rows.length === 0) {
      await sendDeferredResponse(payload.response_url, ephemeralResponse('Risk not found.'));
      return;
    }

    const risk = result.rows[0];
    const severityEmoji: Record<string, string> = {
      critical: ':rotating_light:',
      high: ':warning:',
      medium: ':large_orange_diamond:',
      low: ':white_circle:',
    };
    const emoji = severityEmoji[risk.severity] || ':question:';

    const response: SlackCommandResponse = {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} Risk Details`,
            emoji: true,
          },
        },
        sectionBlock(`*${risk.title}*`),
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Severity:*\n${risk.severity.toUpperCase()}` },
            { type: 'mrkdwn', text: `*Type:*\n${risk.risk_type.replace('_', ' ')}` },
            { type: 'mrkdwn', text: `*Status:*\n${risk.status}` },
            { type: 'mrkdwn', text: `*Confidence:*\n${Math.round((risk.confidence_score || 0) * 100)}%` },
          ],
        },
        sectionBlock(`*Description:*\n${risk.description || 'No description'}`),
      ],
    };

    if (risk.ai_suggestion) {
      response.blocks!.push(sectionBlock(`*:bulb: Suggestion:*\n${risk.ai_suggestion}`));
    }

    if (risk.milestone_title || risk.vision_title) {
      const contextParts = [];
      if (risk.vision_title) contextParts.push(`Vision: ${risk.vision_title}`);
      if (risk.milestone_title) contextParts.push(`Milestone: ${risk.milestone_title}`);
      response.blocks!.push(contextBlock([contextParts.join(' | ')]));
    }

    await sendDeferredResponse(payload.response_url, response);
  } finally {
    client.release();
  }
}

/**
 * Handle "Acknowledge" button click for risk
 */
async function handleAcknowledgeRisk(
  payload: SlackInteractionPayload,
  value: string | undefined
): Promise<void> {
  if (!value || !payload.response_url) return;

  const riskId = value.replace('risk_', '');
  const client = await pool.connect();

  try {
    // Update risk status
    await client.query(`
      UPDATE roadmap_risks SET
        status = 'acknowledged',
        resolution_note = $2
      WHERE id = $1
    `, [riskId, `Acknowledged by ${payload.user.username} via Slack`]);

    // Log to history
    await client.query(`
      INSERT INTO roadmap_risk_history (risk_id, action, new_status, note)
      VALUES ($1, 'acknowledged', 'acknowledged', $2)
    `, [riskId, `Acknowledged by ${payload.user.username} via Slack`]);

    await sendDeferredResponse(payload.response_url, {
      response_type: 'ephemeral',
      text: ':white_check_mark: Risk acknowledged successfully.',
      replace_original: false,
    });
  } catch (error) {
    console.error('Failed to acknowledge risk:', error);
    await sendDeferredResponse(payload.response_url, {
      response_type: 'ephemeral',
      text: ':x: Failed to acknowledge risk.',
    });
  } finally {
    client.release();
  }
}

/**
 * Handle "View Sprint" button click
 */
async function handleViewSprint(
  payload: SlackInteractionPayload,
  value: string | undefined
): Promise<void> {
  if (!value || !payload.response_url) return;

  const sprintId = value.replace('sprint_', '');
  const client = await pool.connect();

  try {
    const sprintResult = await client.query(`
      SELECT * FROM jira_sprints WHERE id = $1
    `, [sprintId]);

    if (sprintResult.rows.length === 0) {
      await sendDeferredResponse(payload.response_url, ephemeralResponse('Sprint not found.'));
      return;
    }

    const sprint = sprintResult.rows[0];

    // Get detailed issue breakdown
    const issuesResult = await client.query(`
      SELECT
        key,
        raw_data->'fields'->>'summary' as summary,
        raw_data->'fields'->'status'->>'name' as status,
        raw_data->'fields'->'assignee'->>'displayName' as assignee
      FROM jira_issues
      WHERE $1 = ANY(
        SELECT (s->>'id')::text
        FROM jsonb_array_elements(COALESCE(raw_data->'fields'->'sprints', '[]')) s
      )
         OR raw_data->'fields'->'sprint'->>'id' = $1
      ORDER BY
        CASE raw_data->'fields'->'status'->>'name'
          WHEN 'In Progress' THEN 1
          WHEN 'In Review' THEN 2
          WHEN 'Blocked' THEN 3
          ELSE 4
        END
      LIMIT 15
    `, [String(sprint.id)]);

    const response: SlackCommandResponse = {
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `:runner: ${sprint.name}`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*State:*\n${sprint.state}` },
            { type: 'mrkdwn', text: `*Issues:*\n${issuesResult.rows.length}` },
          ],
        },
      ],
    };

    if (sprint.start_date || sprint.end_date) {
      response.blocks!.push(
        contextBlock([
          `Start: ${sprint.start_date?.slice(0, 10) || 'N/A'} | End: ${sprint.end_date?.slice(0, 10) || 'N/A'}`,
        ])
      );
    }

    if (sprint.goal) {
      response.blocks!.push(sectionBlock(`*Goal:*\n${sprint.goal}`));
    }

    // Add issue list
    if (issuesResult.rows.length > 0) {
      response.blocks!.push({ type: 'divider' });
      const issuesList = issuesResult.rows
        .slice(0, 10)
        .map((i) => `• *${i.key}*: ${i.summary?.slice(0, 50)}${(i.summary?.length || 0) > 50 ? '...' : ''} (${i.status})`)
        .join('\n');
      response.blocks!.push(sectionBlock(`*Issues:*\n${issuesList}`));
    }

    await sendDeferredResponse(payload.response_url, response);
  } finally {
    client.release();
  }
}
