import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/local-epics/[id] - Get a single local epic
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  try {
    const result = await pool.query(
      `SELECT
        le.*,
        m.title as milestone_title,
        v.title as vision_title,
        v.project_key
       FROM roadmap_local_epics le
       LEFT JOIN roadmap_milestones m ON m.id = le.milestone_id
       LEFT JOIN roadmap_visions v ON v.id = m.vision_id
       WHERE le.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Local epic not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching local epic:', error);
    return NextResponse.json(
      { error: 'Failed to fetch local epic' },
      { status: 500 }
    );
  }
}

// PUT /api/roadmap/local-epics/[id] - Update a local epic
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await params;

  try {
    const body = await request.json();
    const {
      title,
      description,
      assignee,
      priority,
      status,
      story_points,
      sort_order,
      jira_key,
    } = body;

    const result = await pool.query(
      `UPDATE roadmap_local_epics SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        assignee = COALESCE($4, assignee),
        priority = COALESCE($5, priority),
        status = COALESCE($6, status),
        story_points = COALESCE($7, story_points),
        sort_order = COALESCE($8, sort_order),
        jira_key = COALESCE($9, jira_key),
        updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, title, description, assignee, priority, status, story_points, sort_order, jira_key]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Local epic not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating local epic:', error);
    return NextResponse.json(
      { error: 'Failed to update local epic' },
      { status: 500 }
    );
  }
}

// DELETE /api/roadmap/local-epics/[id] - Delete a local epic
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await params;

  try {
    const result = await pool.query(
      `DELETE FROM roadmap_local_epics WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Local epic not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted_id: id });
  } catch (error) {
    console.error('Error deleting local epic:', error);
    return NextResponse.json(
      { error: 'Failed to delete local epic' },
      { status: 500 }
    );
  }
}
