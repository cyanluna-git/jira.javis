import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/operations/[id]
 * Get a single operation with full details
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Invalid operation ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Get operation
    const opResult = await client.query(
      `SELECT * FROM content_operations WHERE id = $1`,
      [id]
    );

    if (opResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    // Get history records
    const historyResult = await client.query(
      `SELECT id, target_type, target_id, changed_fields, rolled_back, created_at
       FROM content_history
       WHERE operation_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return NextResponse.json({
      operation: opResult.rows[0],
      history: historyResult.rows
    });

  } catch (error) {
    console.error('Error fetching operation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * POST /api/operations/[id]
 * Perform actions on an operation (approve, execute, cancel, rollback)
 *
 * Body: { action: 'approve' | 'cancel' | 'rollback', user?: string }
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Invalid operation ID format' },
      { status: 400 }
    );
  }

  let body: { action: string; user?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const validActions = ['approve', 'cancel', 'rollback'];
  if (!body.action || !validActions.includes(body.action)) {
    return NextResponse.json(
      { error: 'Invalid action', valid: validActions },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Get current operation
    const opResult = await client.query(
      `SELECT * FROM content_operations WHERE id = $1`,
      [id]
    );

    if (opResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    const operation = opResult.rows[0];

    switch (body.action) {
      case 'approve': {
        if (operation.status !== 'pending') {
          return NextResponse.json(
            { error: `Cannot approve operation with status '${operation.status}'` },
            { status: 400 }
          );
        }

        await client.query(
          `UPDATE content_operations
           SET status = 'approved', approved_at = NOW(), approved_by = $2
           WHERE id = $1`,
          [id, body.user || 'api']
        );

        return NextResponse.json({
          success: true,
          message: 'Operation approved'
        });
      }

      case 'cancel': {
        if (!['pending', 'approved'].includes(operation.status)) {
          return NextResponse.json(
            { error: `Cannot cancel operation with status '${operation.status}'` },
            { status: 400 }
          );
        }

        await client.query(
          `UPDATE content_operations SET status = 'cancelled' WHERE id = $1`,
          [id]
        );

        return NextResponse.json({
          success: true,
          message: 'Operation cancelled'
        });
      }

      case 'rollback': {
        if (operation.status !== 'completed') {
          return NextResponse.json(
            { error: 'Can only rollback completed operations' },
            { status: 400 }
          );
        }

        // Get history records that haven't been rolled back
        const historyResult = await client.query(
          `SELECT * FROM content_history
           WHERE operation_id = $1 AND rolled_back = FALSE
           ORDER BY created_at DESC`,
          [id]
        );

        if (historyResult.rows.length === 0) {
          return NextResponse.json(
            { error: 'No history records to rollback' },
            { status: 400 }
          );
        }

        // Mark history records as rolled back
        // Note: Actual data restoration should be handled by execute_operations.py
        // This API just marks the intent
        await client.query(
          `UPDATE content_history
           SET rolled_back = TRUE, rolled_back_at = NOW(), rolled_back_by = $2
           WHERE operation_id = $1 AND rolled_back = FALSE`,
          [id, body.user || 'api']
        );

        return NextResponse.json({
          success: true,
          message: `Marked ${historyResult.rows.length} history records for rollback`,
          note: 'Run execute_operations.py --rollback to apply the rollback'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error performing action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/operations/[id]
 * Update operation details (e.g., preview_data after AI processing)
 */
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Invalid operation ID format' },
      { status: 400 }
    );
  }

  let body: {
    operation_data?: Record<string, unknown>;
    preview_data?: Record<string, unknown>;
    ai_response?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    // Check operation exists and is still pending
    const opResult = await client.query(
      `SELECT status FROM content_operations WHERE id = $1`,
      [id]
    );

    if (opResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Operation not found' },
        { status: 404 }
      );
    }

    if (opResult.rows[0].status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only update pending operations' },
        { status: 400 }
      );
    }

    // Build update
    const updates: string[] = [];
    const values: (string | null)[] = [];
    let paramIndex = 1;

    if (body.operation_data) {
      updates.push(`operation_data = $${paramIndex++}`);
      values.push(JSON.stringify(body.operation_data));
    }

    if (body.preview_data) {
      updates.push(`preview_data = $${paramIndex++}`);
      values.push(JSON.stringify(body.preview_data));
    }

    if (body.ai_response) {
      updates.push(`ai_response = $${paramIndex++}`);
      values.push(JSON.stringify(body.ai_response));
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await client.query(
      `UPDATE content_operations
       SET ${updates.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING *`,
      values
    );

    return NextResponse.json({
      success: true,
      operation: result.rows[0]
    });

  } catch (error) {
    console.error('Error updating operation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * DELETE /api/operations/[id]
 * Delete a pending or cancelled operation
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await context.params;

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return NextResponse.json(
      { error: 'Invalid operation ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      `DELETE FROM content_operations
       WHERE id = $1 AND status IN ('pending', 'cancelled')
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Operation not found or cannot be deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Operation deleted'
    });

  } catch (error) {
    console.error('Error deleting operation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
