import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Vision, VisionWithMilestones, UpdateVisionInput } from '@/types/roadmap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/visions/[id] - Get vision with milestones and streams
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    // Get vision
    const visionResult = await client.query<Vision>(`
      SELECT * FROM roadmap_visions WHERE id = $1
    `, [id]);

    if (visionResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vision not found' },
        { status: 404 }
      );
    }

    const vision = visionResult.rows[0];

    // Get milestones with streams and epic links
    const milestonesResult = await client.query(`
      SELECT
        m.*,
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
      LEFT JOIN roadmap_streams s ON s.milestone_id = m.id
      LEFT JOIN roadmap_epic_links e ON e.milestone_id = m.id
      WHERE m.vision_id = $1
      GROUP BY m.id
      ORDER BY m.target_start ASC NULLS LAST, m.created_at ASC
    `, [id]);

    // Calculate aggregates
    const milestones = milestonesResult.rows;
    const completedMilestones = milestones.filter(m => m.status === 'completed').length;
    const overallProgress = milestones.length > 0
      ? milestones.reduce((sum, m) => sum + Number(m.progress_percent), 0) / milestones.length
      : 0;

    const result: VisionWithMilestones = {
      ...vision,
      milestones,
      milestone_count: milestones.length,
      completed_milestones: completedMilestones,
      overall_progress: Math.round(overallProgress * 100) / 100,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching vision:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vision' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PUT /api/roadmap/visions/[id] - Update vision
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body: UpdateVisionInput = await request.json();

    // Build dynamic update query
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
    if (body.north_star_metric !== undefined) {
      updates.push(`north_star_metric = $${paramIndex++}`);
      values.push(body.north_star_metric);
    }
    if (body.north_star_target !== undefined) {
      updates.push(`north_star_target = $${paramIndex++}`);
      values.push(body.north_star_target);
    }
    if (body.north_star_current !== undefined) {
      updates.push(`north_star_current = $${paramIndex++}`);
      values.push(body.north_star_current);
    }
    if (body.target_date !== undefined) {
      updates.push(`target_date = $${paramIndex++}`);
      values.push(body.target_date);
    }
    if (body.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(body.status);
    }
    if (body.owner_account_id !== undefined) {
      updates.push(`owner_account_id = $${paramIndex++}`);
      values.push(body.owner_account_id);
    }
    if (body.jql_filter !== undefined) {
      updates.push(`jql_filter = $${paramIndex++}`);
      values.push(body.jql_filter);
    }
    if (body.default_component !== undefined) {
      updates.push(`default_component = $${paramIndex++}`);
      values.push(body.default_component);
    }
    if (body.default_labels !== undefined) {
      updates.push(`default_labels = $${paramIndex++}`);
      values.push(body.default_labels);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const result = await client.query<Vision>(`
      UPDATE roadmap_visions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vision not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vision:', error);
    return NextResponse.json(
      { error: 'Failed to update vision' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE /api/roadmap/visions/[id] - Archive vision (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const result = await client.query<Vision>(`
      UPDATE roadmap_visions
      SET status = 'archived'
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vision not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error archiving vision:', error);
    return NextResponse.json(
      { error: 'Failed to archive vision' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
