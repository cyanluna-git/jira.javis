import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Milestone, MilestoneWithStreams, UpdateMilestoneInput, CreateStreamInput } from '@/types/roadmap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/milestones/[id] - Get milestone with streams and epic links
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT
        m.*,
        v.title as vision_title,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', s.id,
            'milestone_id', s.milestone_id,
            'name', s.name,
            'category', s.category,
            'color', s.color,
            'progress_percent', s.progress_percent,
            'owner_account_id', s.owner_account_id,
            'created_at', s.created_at
          )) FILTER (WHERE s.id IS NOT NULL),
          '[]'
        ) as streams,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object(
            'id', e.id,
            'milestone_id', e.milestone_id,
            'stream_id', e.stream_id,
            'epic_key', e.epic_key,
            'last_synced_at', e.last_synced_at,
            'created_at', e.created_at
          )) FILTER (WHERE e.id IS NOT NULL),
          '[]'
        ) as epic_links
      FROM roadmap_milestones m
      LEFT JOIN roadmap_visions v ON v.id = m.vision_id
      LEFT JOIN roadmap_streams s ON s.milestone_id = m.id
      LEFT JOIN roadmap_epic_links e ON e.milestone_id = m.id
      WHERE m.id = $1
      GROUP BY m.id, v.title
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0] as MilestoneWithStreams);
  } catch (error) {
    console.error('Error fetching milestone:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestone' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PUT /api/roadmap/milestones/[id] - Update milestone
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body: UpdateMilestoneInput = await request.json();

    const updates: string[] = [];
    const values: (string | number | string[] | null)[] = [];
    let paramIndex = 1;

    if (body.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(body.title);
    }
    if (body.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(body.description);
    }
    if (body.quarter !== undefined) {
      updates.push(`quarter = $${paramIndex++}`);
      values.push(body.quarter);
    }
    if (body.progress_percent !== undefined) {
      updates.push(`progress_percent = $${paramIndex++}`);
      values.push(body.progress_percent);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }
    if (body.risk_level !== undefined) {
      updates.push(`risk_level = $${paramIndex++}`);
      values.push(body.risk_level);
    }
    if (body.depends_on !== undefined) {
      updates.push(`depends_on = $${paramIndex++}`);
      values.push(body.depends_on);
    }
    if (body.target_start !== undefined) {
      updates.push(`target_start = $${paramIndex++}`);
      values.push(body.target_start);
    }
    if (body.target_end !== undefined) {
      updates.push(`target_end = $${paramIndex++}`);
      values.push(body.target_end);
    }
    if (body.owner_account_id !== undefined) {
      updates.push(`owner_account_id = $${paramIndex++}`);
      values.push(body.owner_account_id);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const result = await client.query<Milestone>(`
      UPDATE roadmap_milestones
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to update milestone' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE /api/roadmap/milestones/[id] - Delete milestone
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const result = await client.query<Milestone>(`
      DELETE FROM roadmap_milestones
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    return NextResponse.json(
      { error: 'Failed to delete milestone' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
