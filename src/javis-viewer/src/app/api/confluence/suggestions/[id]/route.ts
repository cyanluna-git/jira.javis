import { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import pool from '@/lib/db';
import { enforceWriteAccess } from '@/lib/readonly';
import { getUserIdentityKey, resolveAccessContextFromRequest } from '@/lib/access';
import {
  ConfluenceWriteError,
  directArchiveConfluencePage,
  directMoveConfluencePage,
  directUpdateConfluenceLabels,
} from '@/lib/confluence-user-write';
import { recordExternalWriteEvent } from '@/lib/external-write-audit';
import type { ArchiveSuggestion, LabelSuggestion, RestructureSuggestion } from '@/types/confluence';

// GET /api/confluence/suggestions/[id] - Get suggestion details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid suggestion ID format' },
        { status: 400 }
      );
    }

    const result = await client.query(`
      SELECT
        s.*,
        (
          SELECT json_agg(json_build_object(
            'id', c.id,
            'title', c.title,
            'web_url', c.web_url,
            'body_storage', c.body_storage
          ))
          FROM confluence_v2_content c
          WHERE c.id = ANY(s.target_page_ids)
        ) as target_pages
      FROM confluence_ai_suggestions s
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestion' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PATCH /api/confluence/suggestions/[id] - Update suggestion (approve/reject)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessDenied = await enforceWriteAccess(request, 'confluence');
  if (accessDenied) return accessDenied;

  const access = await resolveAccessContextFromRequest(request);
  const appUserKey = getUserIdentityKey(access.user);
  if (!appUserKey) {
    return NextResponse.json(
      { error: 'Authenticated session found, but user identity could not be resolved' },
      { status: 409 }
    );
  }

  const { id } = await params;
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid suggestion ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action, reviewed_by } = body;
    const reviewer =
      typeof reviewed_by === 'string' && reviewed_by.trim()
        ? reviewed_by.trim()
        : access.user?.email ?? access.user?.name ?? access.user?.username ?? appUserKey;

    if (!action || !['approve', 'reject', 'apply'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve", "reject", or "apply"' },
        { status: 400 }
      );
    }

    await client.query('BEGIN');
    transactionStarted = true;

    const checkResult = await client.query(
      `
        SELECT
          s.*,
          c.labels AS current_labels,
          c.parent_id AS current_parent_id,
          c.raw_data AS current_raw_data
        FROM confluence_ai_suggestions s
        LEFT JOIN confluence_v2_content c
          ON c.id = COALESCE(s.suggested_action->>'page_id', s.target_page_ids[1])
        WHERE s.id = $1
        FOR UPDATE OF s
      `,
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    const suggestion = checkResult.rows[0];
    const currentStatus = typeof suggestion.status === 'string' ? suggestion.status : 'pending';

    if (action === 'apply') {
      if (currentStatus !== 'pending' && currentStatus !== 'approved') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Can only apply pending or approved suggestions' },
          { status: 400 }
        );
      }

      const pageId = extractSuggestionPageId(suggestion);
      if (!pageId) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Suggestion does not reference a target page' },
          { status: 400 }
        );
      }

      let appliedPayload: Record<string, unknown>;
      let auditAction: string;

      switch (suggestion.suggestion_type) {
        case 'label': {
          const labelSuggestion = parseLabelSuggestion(suggestion.suggested_action);
          if (!labelSuggestion) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { error: 'Suggestion payload is missing a valid label action' },
              { status: 400 }
            );
          }

          const applied = await directUpdateConfluenceLabels(appUserKey, {
            pageId,
            currentLabels: normalizeStringArray(suggestion.current_labels),
            addLabels: labelSuggestion.add_labels,
            removeLabels: labelSuggestion.remove_labels,
          });

          await client.query(
            `
              UPDATE confluence_v2_content
              SET labels = $2::text[],
                  last_synced_at = NOW(),
                  local_modified_at = NOW(),
                  local_modified_fields = '["labels"]'::jsonb
              WHERE id = $1
            `,
            [pageId, applied.labels]
          );

          appliedPayload = {
            page_id: pageId,
            labels: applied.labels,
            added: applied.addedLabels,
            removed: applied.removedLabels,
          };
          auditAction = 'label_apply';
          break;
        }

        case 'restructure': {
          const restructureSuggestion = parseRestructureSuggestion(suggestion.suggested_action);
          if (!restructureSuggestion) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { error: 'Suggestion payload is missing a valid restructure action' },
              { status: 400 }
            );
          }

          const moved = await directMoveConfluencePage(appUserKey, {
            pageId,
            targetParentId: restructureSuggestion.new_parent_id,
          });

          await client.query(
            `
              UPDATE confluence_v2_content
              SET parent_id = $2,
                  last_synced_at = NOW(),
                  local_modified_at = NOW(),
                  local_modified_fields = '["parent_id"]'::jsonb
              WHERE id = $1
            `,
            [pageId, moved.targetParentId]
          );

          appliedPayload = {
            page_id: pageId,
            new_parent_id: moved.targetParentId,
            previous_parent_id: normalizeNullableString(suggestion.current_parent_id),
          };
          auditAction = 'restructure_apply';
          break;
        }

        case 'archive': {
          const archiveSuggestion = parseArchiveSuggestion(suggestion.suggested_action);
          if (!archiveSuggestion) {
            await client.query('ROLLBACK');
            return NextResponse.json(
              { error: 'Suggestion payload is missing a valid archive action' },
              { status: 400 }
            );
          }

          const archived = await directArchiveConfluencePage(appUserKey, { pageId });

          await client.query(
            `
              UPDATE confluence_v2_content
              SET raw_data = CASE
                    WHEN raw_data IS NULL THEN jsonb_build_object('status', 'archived')
                    WHEN jsonb_typeof(raw_data) = 'object' THEN jsonb_set(raw_data, '{status}', '"archived"', true)
                    ELSE raw_data
                  END,
                  last_synced_at = NOW(),
                  local_modified_at = NOW(),
                  local_modified_fields = '["status"]'::jsonb
              WHERE id = $1
            `,
            [pageId]
          );

          appliedPayload = {
            page_id: pageId,
            archive_reason: archiveSuggestion.archive_reason,
            task_id: archived.taskId,
            status_url: archived.statusUrl,
          };
          auditAction = 'archive_apply';
          break;
        }

        case 'merge': {
          const queuedOperation = await queueConfluenceSuggestionOperation(client, {
            suggestion,
            reviewer,
            appUserKey,
            accessUserEmail: access.user?.email ?? null,
          });

          const result = await client.query(
            `
              UPDATE confluence_ai_suggestions
              SET status = 'approved',
                  reviewed_at = NOW(),
                  reviewed_by = $2,
                  operation_id = $3
              WHERE id = $1
              RETURNING *
            `,
            [id, reviewer, queuedOperation.id]
          );

          await client.query('COMMIT');
          transactionStarted = false;

          try {
            await recordExternalWriteEvent({
              product: 'confluence',
              entityType: 'suggestion',
              entityId: id,
              action: 'merge_operation_queued',
              appUserKey,
              user: access.user,
              payload: {
                suggestionType: suggestion.suggestion_type,
                operationId: queuedOperation.id,
                targetIds: queuedOperation.target_ids,
              },
            });
          } catch (auditError) {
            console.warn('Failed to record Confluence suggestion queue audit event:', auditError);
          }

          return NextResponse.json({
            ...result.rows[0],
            queued_operation: queuedOperation,
          });
        }

        default: {
          await client.query('ROLLBACK');
          return NextResponse.json(
            {
              error: `Direct apply is not yet supported for ${String(suggestion.suggestion_type)} suggestions`,
            },
            { status: 400 }
          );
        }
      }

      const result = await client.query(
        `
          UPDATE confluence_ai_suggestions
          SET status = 'applied',
              reviewed_at = COALESCE(reviewed_at, NOW()),
              reviewed_by = $2,
              applied_at = NOW()
          WHERE id = $1
          RETURNING *
        `,
        [id, reviewer]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      try {
        await recordExternalWriteEvent({
          product: 'confluence',
          entityType: 'page',
          entityId: pageId,
          action: auditAction,
          appUserKey,
          user: access.user,
          payload: {
            suggestionId: id,
            suggestionType: suggestion.suggestion_type,
            ...appliedPayload,
          },
        });
      } catch (auditError) {
        console.warn('Failed to record Confluence write audit event:', auditError);
      }

      return NextResponse.json({
        ...result.rows[0],
        applied_result: appliedPayload,
      });
    }

    if (currentStatus !== 'pending') {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { error: 'Can only approve/reject pending suggestions' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const result = await client.query(`
      UPDATE confluence_ai_suggestions
      SET status = $1, reviewed_at = NOW(), reviewed_by = $2
      WHERE id = $3
      RETURNING *
    `, [newStatus, reviewer || null, id]);

    await client.query('COMMIT');
    transactionStarted = false;

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK');
    }

    if (error instanceof ConfluenceWriteError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          details: error.details,
        },
        { status: error.status }
      );
    }

    console.error('Error updating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

function parseLabelSuggestion(value: unknown): LabelSuggestion | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    page_id: typeof value.page_id === 'string' ? value.page_id : '',
    add_labels: normalizeStringArray(value.add_labels),
    remove_labels: normalizeStringArray(value.remove_labels),
    reasoning: typeof value.reasoning === 'string' ? value.reasoning : '',
  };
}

function parseRestructureSuggestion(value: unknown): RestructureSuggestion | null {
  if (!isObject(value)) {
    return null;
  }

  const newParentId = typeof value.new_parent_id === 'string' ? value.new_parent_id.trim() : '';
  if (!newParentId) {
    return null;
  }

  return {
    page_id: typeof value.page_id === 'string' ? value.page_id : '',
    new_parent_id: newParentId,
    reason: typeof value.reason === 'string' ? value.reason : '',
  };
}

function parseArchiveSuggestion(value: unknown): ArchiveSuggestion | null {
  if (!isObject(value)) {
    return null;
  }

  return {
    page_id: typeof value.page_id === 'string' ? value.page_id : '',
    archive_reason: typeof value.archive_reason === 'string' ? value.archive_reason : '',
    last_modified: typeof value.last_modified === 'string' ? value.last_modified : '',
    no_recent_views: value.no_recent_views === true,
  };
}

function extractSuggestionPageId(suggestion: Record<string, unknown>): string | null {
  if (isObject(suggestion.suggested_action) && typeof suggestion.suggested_action.page_id === 'string') {
    const pageId = suggestion.suggested_action.page_id.trim();
    if (pageId) {
      return pageId;
    }
  }

  if (Array.isArray(suggestion.target_page_ids)) {
    const firstTarget = suggestion.target_page_ids.find(
      (entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())
    );
    if (firstTarget) {
      return firstTarget.trim();
    }
  }

  return null;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim()));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function queueConfluenceSuggestionOperation(
  client: PoolClient,
  params: {
    suggestion: Record<string, unknown>;
    reviewer: string;
    appUserKey: string;
    accessUserEmail: string | null;
  }
) {
  if (params.suggestion.suggestion_type !== 'merge') {
    throw new ConfluenceWriteError('Only merge suggestions can be queued as operations right now', {
      status: 400,
      code: 'CONFLUENCE_OPERATION_QUEUE_UNSUPPORTED',
    });
  }

  const mergeSuggestion = parseMergeSuggestion(params.suggestion.suggested_action);
  if (!mergeSuggestion) {
    throw new ConfluenceWriteError('Suggestion payload is missing a valid merge action', {
      status: 400,
      code: 'CONFLUENCE_MERGE_INVALID',
    });
  }

  const createdBy = params.accessUserEmail ?? params.reviewer ?? params.appUserKey;
  const result = await client.query(
    `
      INSERT INTO content_operations (
        operation_type,
        target_type,
        target_ids,
        operation_data,
        preview_data,
        ai_response,
        created_by,
        status
      )
      VALUES ($1, $2, $3::text[], $4::jsonb, $5::jsonb, $6::jsonb, $7, 'pending')
      RETURNING id, operation_type, target_type, target_ids, status, created_by, created_at
    `,
    [
      'merge',
      'confluence',
      mergeSuggestion.target_ids,
      JSON.stringify({
        destination_id: mergeSuggestion.primary_page_id,
        primary_page_id: mergeSuggestion.primary_page_id,
        secondary_page_ids: mergeSuggestion.secondary_page_ids,
        merged_title: mergeSuggestion.merged_title,
        merge_strategy: mergeSuggestion.merge_strategy,
      }),
      JSON.stringify({
        suggested_action: mergeSuggestion,
        ai_reasoning: normalizeNullableString(params.suggestion.ai_reasoning),
        confidence_score:
          typeof params.suggestion.confidence_score === 'number'
            ? params.suggestion.confidence_score
            : null,
      }),
      JSON.stringify({
        suggestion_id: params.suggestion.id,
      }),
      createdBy,
    ]
  );

  return result.rows[0];
}

function parseMergeSuggestion(
  value: unknown
): {
  primary_page_id: string;
  secondary_page_ids: string[];
  merged_title: string;
  merge_strategy: string;
  target_ids: string[];
} | null {
  if (!isObject(value)) {
    return null;
  }

  const primaryPageId = typeof value.primary_page_id === 'string' ? value.primary_page_id.trim() : '';
  const secondaryPageIds = normalizeStringArray(value.secondary_page_ids);
  if (!primaryPageId || secondaryPageIds.length === 0) {
    return null;
  }

  return {
    primary_page_id: primaryPageId,
    secondary_page_ids: secondaryPageIds,
    merged_title:
      typeof value.merged_title === 'string' && value.merged_title.trim()
        ? value.merged_title.trim()
        : '',
    merge_strategy:
      typeof value.merge_strategy === 'string' && value.merge_strategy.trim()
        ? value.merge_strategy.trim()
        : 'append',
    target_ids: [primaryPageId, ...secondaryPageIds],
  };
}

// DELETE /api/confluence/suggestions/[id] - Delete suggestion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accessDenied = await enforceWriteAccess(request, 'confluence');
  if (accessDenied) return accessDenied;

  const { id } = await params;
  const client = await pool.connect();

  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid suggestion ID format' },
        { status: 400 }
      );
    }

    const result = await client.query(
      'DELETE FROM confluence_ai_suggestions WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Error deleting suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to delete suggestion' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
