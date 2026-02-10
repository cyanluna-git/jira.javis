import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

// Valid operation types
const VALID_OPERATION_TYPES = [
  'merge', 'restructure', 'summarize', 'update_field',
  'bulk_transition', 'link_issues', 'archive', 'move'
];

const VALID_TARGET_TYPES = ['jira', 'confluence'];

const VALID_STATUSES = ['pending', 'approved', 'executing', 'completed', 'failed', 'cancelled'];

/**
 * GET /api/operations
 * List operations with optional filtering
 *
 * Query params:
 *   - status: filter by status
 *   - target_type: filter by target type (jira|confluence)
 *   - limit: max results (default 50)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status');
  const targetType = searchParams.get('target_type');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  const client = await pool.connect();
  try {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (status && VALID_STATUSES.includes(status)) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(status);
    }

    if (targetType && VALID_TARGET_TYPES.includes(targetType)) {
      conditions.push(`target_type = $${paramIndex++}`);
      values.push(targetType);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    values.push(limit);

    const query = `
      SELECT
        id, operation_type, target_type, target_ids,
        status, error_message, created_by, approved_by,
        created_at, approved_at, executed_at
      FROM content_operations
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `;

    const result = await client.query(query, values);

    // Get counts by status
    const countsResult = await client.query(`
      SELECT status, COUNT(*) as count
      FROM content_operations
      GROUP BY status
    `);

    const counts: Record<string, number> = {};
    countsResult.rows.forEach(row => {
      counts[row.status] = parseInt(row.count);
    });

    return NextResponse.json({
      operations: result.rows,
      counts,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Error listing operations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * POST /api/operations
 * Create a new operation
 */
export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  let body: {
    operation_type: string;
    target_type: string;
    target_ids: string[];
    operation_data: Record<string, unknown>;
    ai_prompt?: string;
    ai_response?: Record<string, unknown>;
    preview_data?: Record<string, unknown>;
    created_by?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Validation
  if (!body.operation_type || !VALID_OPERATION_TYPES.includes(body.operation_type)) {
    return NextResponse.json(
      { error: 'Invalid operation_type', valid: VALID_OPERATION_TYPES },
      { status: 400 }
    );
  }

  if (!body.target_type || !VALID_TARGET_TYPES.includes(body.target_type)) {
    return NextResponse.json(
      { error: 'Invalid target_type', valid: VALID_TARGET_TYPES },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.target_ids) || body.target_ids.length === 0) {
    return NextResponse.json(
      { error: 'target_ids must be a non-empty array' },
      { status: 400 }
    );
  }

  if (!body.operation_data || typeof body.operation_data !== 'object') {
    return NextResponse.json(
      { error: 'operation_data is required and must be an object' },
      { status: 400 }
    );
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      INSERT INTO content_operations (
        operation_type, target_type, target_ids,
        operation_data, ai_prompt, ai_response, preview_data,
        created_by, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
      RETURNING *
    `, [
      body.operation_type,
      body.target_type,
      body.target_ids,
      JSON.stringify(body.operation_data),
      body.ai_prompt || null,
      body.ai_response ? JSON.stringify(body.ai_response) : null,
      body.preview_data ? JSON.stringify(body.preview_data) : null,
      body.created_by || 'api'
    ]);

    return NextResponse.json({
      success: true,
      operation: result.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating operation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
