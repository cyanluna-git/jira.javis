import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

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
  if (isReadOnlyMode()) return readOnlyResponse();

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

    const body = await request.json();
    const { action, reviewed_by } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    // Check current status
    const checkResult = await client.query(
      'SELECT status FROM confluence_ai_suggestions WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    if (checkResult.rows[0].status !== 'pending') {
      return NextResponse.json(
        { error: 'Can only approve/reject pending suggestions' },
        { status: 400 }
      );
    }

    // Update status
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const result = await client.query(`
      UPDATE confluence_ai_suggestions
      SET status = $1, reviewed_at = NOW(), reviewed_by = $2
      WHERE id = $3
      RETURNING *
    `, [newStatus, reviewed_by || null, id]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to update suggestion' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE /api/confluence/suggestions/[id] - Delete suggestion
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (isReadOnlyMode()) return readOnlyResponse();

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
