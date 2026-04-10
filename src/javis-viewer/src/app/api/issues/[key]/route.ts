import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { enforceWriteAccess } from '@/lib/readonly';
import { getUserIdentityKey, resolveAccessContextFromRequest } from '@/lib/access';
import { directUpdateJiraIssue, JiraWriteError } from '@/lib/jira-user-write';
import { recordExternalWriteEvent } from '@/lib/external-write-audit';

interface RouteContext {
  params: Promise<{ key: string }>;
}

// Allowed fields for direct Jira update
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
 * Update issue fields directly in Jira using the connected user's Atlassian token,
 * then refresh the local mirror row from the remote issue payload.
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const accessDenied = await enforceWriteAccess(request, 'jira');
  if (accessDenied) return accessDenied;

  const access = await resolveAccessContextFromRequest(request);
  const appUserKey = getUserIdentityKey(access.user);
  if (!appUserKey) {
    return NextResponse.json(
      { error: 'Authenticated session found, but user identity could not be resolved' },
      { status: 409 }
    );
  }

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

  try {
    const remoteResult = await directUpdateJiraIssue(appUserKey, key, body);
    const remoteIssue = remoteResult.issue;
    const remoteFields = typeof remoteIssue.fields === 'object' && remoteIssue.fields !== null
      ? remoteIssue.fields as Record<string, unknown>
      : {};

    const summary =
      typeof remoteFields.summary === 'string' && remoteFields.summary.trim()
        ? remoteFields.summary.trim()
        : key;
    const status =
      typeof (remoteFields.status as { name?: unknown } | undefined)?.name === 'string'
        ? String((remoteFields.status as { name?: unknown }).name)
        : 'Unknown';
    const project =
      typeof (remoteFields.project as { key?: unknown } | undefined)?.key === 'string'
        ? String((remoteFields.project as { key?: unknown }).key)
        : null;
    const createdAt =
      typeof remoteFields.created === 'string' ? remoteFields.created : null;
    const updatedAt =
      typeof remoteFields.updated === 'string' ? remoteFields.updated : null;

    const client = await pool.connect();
    try {
      const result = await client.query(
        `
          INSERT INTO jira_issues (
            key,
            project,
            summary,
            status,
            created_at,
            updated_at,
            raw_data,
            last_synced_at,
            local_modified_at,
            local_modified_fields
          )
          VALUES (
            $1,
            COALESCE($2, split_part($1, '-', 1)),
            $3,
            $4,
            COALESCE($5::timestamp, NOW()),
            COALESCE($6::timestamp, NOW()),
            $7::jsonb,
            NOW(),
            NULL,
            NULL
          )
          ON CONFLICT (key) DO UPDATE SET
            project = COALESCE(EXCLUDED.project, jira_issues.project),
            summary = EXCLUDED.summary,
            status = EXCLUDED.status,
            updated_at = COALESCE(EXCLUDED.updated_at, jira_issues.updated_at),
            raw_data = EXCLUDED.raw_data,
            last_synced_at = NOW(),
            local_modified_at = NULL,
            local_modified_fields = NULL
          RETURNING key, project, summary, status, raw_data, last_synced_at, local_modified_at, local_modified_fields
        `,
        [
          key,
          project,
          summary,
          status,
          createdAt,
          updatedAt,
          JSON.stringify(remoteIssue),
        ]
      );

      try {
        await recordExternalWriteEvent({
          product: 'jira',
          entityType: 'issue',
          entityId: key,
          action: remoteResult.transitioned ? 'issue_update_and_transition' : 'issue_update',
          appUserKey,
          user: access.user,
          payload: {
            modifiedFields: remoteResult.updatedFields,
            transitioned: remoteResult.transitioned,
            project: result.rows[0].project ?? null,
          },
        });
      } catch (auditError) {
        console.warn('Failed to record Jira write audit event:', auditError);
      }

      return NextResponse.json({
        success: true,
        issue: result.rows[0],
        modifiedFields: remoteResult.updatedFields,
        transitioned: remoteResult.transitioned,
      });
    } finally {
      client.release();
    }

  } catch (error) {
    if (error instanceof JiraWriteError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status }
      );
    }

    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/issues/[key]/local-changes
 * Discard local changes and reset to last synced state
 * (Actually handled by a separate endpoint, but documenting the pattern)
 */
