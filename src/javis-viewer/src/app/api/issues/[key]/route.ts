import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

interface RouteContext {
  params: Promise<{ key: string }>;
}

// Allowed fields for local modification
const ALLOWED_FIELDS = ['summary', 'status', 'assignee', 'priority', 'labels', 'description'];

/**
 * GET /api/issues/[key]
 * Fetch a single issue by key
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { key } = await context.params;

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT key, project, summary, status, created_at, updated_at, raw_data, last_synced_at
       FROM jira_issues
       WHERE key = $1`,
      [key]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching issue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/issues/[key]
 * Update issue fields locally (marks as locally modified for later sync)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { key } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Filter to allowed fields only
  const updates = Object.keys(body).filter(k => ALLOWED_FIELDS.includes(k));

  if (updates.length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update', allowedFields: ALLOWED_FIELDS },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // First, get current issue to merge raw_data
    const current = await client.query(
      `SELECT raw_data FROM jira_issues WHERE key = $1`,
      [key]
    );

    if (current.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      );
    }

    const currentRawData = current.rows[0].raw_data || { fields: {} };

    // Build update query dynamically
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    // Update individual columns
    if ('summary' in body) {
      setClauses.push(`summary = $${paramIndex++}`);
      values.push(body.summary);
      currentRawData.fields.summary = body.summary;
    }

    if ('status' in body) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(body.status);
      // Status in raw_data is an object
      if (currentRawData.fields.status) {
        currentRawData.fields.status.name = body.status;
      } else {
        currentRawData.fields.status = { name: body.status };
      }
    }

    // Update raw_data for other fields
    if ('assignee' in body) {
      if (typeof body.assignee === 'string') {
        currentRawData.fields.assignee = { accountId: body.assignee };
      } else {
        currentRawData.fields.assignee = body.assignee;
      }
    }

    if ('priority' in body) {
      if (typeof body.priority === 'string') {
        currentRawData.fields.priority = { name: body.priority };
      } else {
        currentRawData.fields.priority = body.priority;
      }
    }

    if ('labels' in body) {
      currentRawData.fields.labels = body.labels;
    }

    if ('description' in body) {
      currentRawData.fields.description = body.description;
    }

    // Always update raw_data with merged fields
    setClauses.push(`raw_data = $${paramIndex++}`);
    values.push(JSON.stringify(currentRawData));

    // NOTE: Do NOT update last_synced_at here!
    // The PostgreSQL trigger (trg_track_jira_changes) automatically sets
    // local_modified_at and local_modified_fields when last_synced_at is unchanged.
    // This marks the change as a "local modification" for bidirectional sync.

    // Add key as last parameter
    values.push(key);

    const query = `
      UPDATE jira_issues
      SET ${setClauses.join(', ')}
      WHERE key = $${paramIndex}
      RETURNING key, summary, status, local_modified_at, local_modified_fields
    `;

    const result = await client.query(query, values);

    return NextResponse.json({
      success: true,
      issue: result.rows[0],
      modifiedFields: updates
    });

  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/issues/[key]/local-changes
 * Discard local changes and reset to last synced state
 * (Actually handled by a separate endpoint, but documenting the pattern)
 */
