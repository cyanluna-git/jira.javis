import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';
import type { Milestone, MilestoneWithStreams, CreateMilestoneInput, QuarterlyMilestones } from '@/types/roadmap';

// GET /api/roadmap/milestones - List milestones with optional filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const visionId = searchParams.get('vision_id');
  const quarter = searchParams.get('quarter');
  const status = searchParams.get('status');
  const riskLevel = searchParams.get('risk_level');
  const groupByQuarter = searchParams.get('group_by_quarter');

  const client = await pool.connect();

  try {
    const conditions: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    if (visionId) {
      conditions.push(`m.vision_id = $${paramIndex++}`);
      values.push(visionId);
    }

    if (quarter) {
      conditions.push(`m.quarter = $${paramIndex++}`);
      values.push(quarter);
    }

    if (status) {
      conditions.push(`m.status = $${paramIndex++}`);
      values.push(status);
    }

    if (riskLevel) {
      conditions.push(`m.risk_level = $${paramIndex++}`);
      values.push(riskLevel);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

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
      ${whereClause}
      GROUP BY m.id, v.title
      ORDER BY m.quarter ASC NULLS LAST, m.target_start ASC NULLS LAST, m.created_at ASC
    `, values);

    // Group by quarter if requested
    if (groupByQuarter === 'true') {
      const grouped: Record<string, MilestoneWithStreams[]> = {};
      result.rows.forEach((milestone: MilestoneWithStreams) => {
        const q = milestone.quarter || 'Unscheduled';
        if (!grouped[q]) {
          grouped[q] = [];
        }
        grouped[q].push(milestone);
      });

      const quarterlyMilestones: QuarterlyMilestones[] = Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([quarter, milestones]) => ({ quarter, milestones }));

      return NextResponse.json(quarterlyMilestones);
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return NextResponse.json(
      { error: 'Failed to fetch milestones' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/roadmap/milestones - Create a new milestone
export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const client = await pool.connect();

  try {
    const body: CreateMilestoneInput = await request.json();

    if (!body.vision_id || !body.title) {
      return NextResponse.json(
        { error: 'vision_id and title are required' },
        { status: 400 }
      );
    }

    // Verify vision exists
    const visionCheck = await client.query(
      'SELECT id FROM roadmap_visions WHERE id = $1',
      [body.vision_id]
    );
    if (visionCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Vision not found' },
        { status: 404 }
      );
    }

    const result = await client.query<Milestone>(`
      INSERT INTO roadmap_milestones (
        vision_id, title, description, quarter,
        status, risk_level, depends_on,
        target_start, target_end, owner_account_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      body.vision_id,
      body.title,
      body.description || null,
      body.quarter || null,
      body.status || 'planned',
      body.risk_level || 'low',
      body.depends_on || null,
      body.target_start || null,
      body.target_end || null,
      body.owner_account_id || null,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating milestone:', error);
    return NextResponse.json(
      { error: 'Failed to create milestone' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
