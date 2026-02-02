import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';
import type { Vision, CreateVisionInput, RoadmapSummary } from '@/types/roadmap';

// GET /api/roadmap/visions - List visions with optional filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectKey = searchParams.get('project_key');
  const status = searchParams.get('status');
  const summary = searchParams.get('summary');

  const client = await pool.connect();

  try {
    // Return dashboard summary stats
    if (summary === 'true') {
      const summaryResult = await client.query<RoadmapSummary>(`
        SELECT
          (SELECT COUNT(*) FROM roadmap_visions)::int as total_visions,
          (SELECT COUNT(*) FROM roadmap_visions WHERE status = 'active')::int as active_visions,
          (SELECT COUNT(*) FROM roadmap_milestones)::int as total_milestones,
          (SELECT COUNT(*) FROM roadmap_milestones WHERE risk_level IN ('high', 'critical'))::int as milestones_at_risk,
          COALESCE((SELECT AVG(progress_percent) FROM roadmap_milestones), 0)::numeric(5,2) as overall_progress
      `);

      const statusCounts = await client.query(`
        SELECT status, COUNT(*)::int as count
        FROM roadmap_milestones
        GROUP BY status
      `);

      const milestones_by_status: Record<string, number> = {
        planned: 0,
        in_progress: 0,
        completed: 0,
        delayed: 0,
        blocked: 0,
      };
      statusCounts.rows.forEach(row => {
        milestones_by_status[row.status] = row.count;
      });

      return NextResponse.json({
        ...summaryResult.rows[0],
        milestones_by_status,
      });
    }

    // Build query with filters
    const conditions: string[] = [];
    const values: string[] = [];
    let paramIndex = 1;

    if (projectKey) {
      conditions.push(`v.project_key = $${paramIndex++}`);
      values.push(projectKey);
    }

    if (status) {
      conditions.push(`v.status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await client.query(`
      SELECT
        v.*,
        COUNT(m.id)::int as milestone_count,
        COUNT(CASE WHEN m.status = 'completed' THEN 1 END)::int as completed_milestones,
        COALESCE(AVG(m.progress_percent), 0)::numeric(5,2) as overall_progress
      FROM roadmap_visions v
      LEFT JOIN roadmap_milestones m ON m.vision_id = v.id
      ${whereClause}
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `, values);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching visions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch visions' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/roadmap/visions - Create a new vision
export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const client = await pool.connect();

  try {
    const body: CreateVisionInput = await request.json();

    if (!body.project_key || !body.title) {
      return NextResponse.json(
        { error: 'project_key and title are required' },
        { status: 400 }
      );
    }

    const result = await client.query<Vision>(`
      INSERT INTO roadmap_visions (
        project_key, title, description,
        north_star_metric, north_star_target, north_star_current,
        target_date, owner_account_id, jql_filter
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      body.project_key,
      body.title,
      body.description || null,
      body.north_star_metric || null,
      body.north_star_target || null,
      body.north_star_current || null,
      body.target_date || null,
      body.owner_account_id || null,
      body.jql_filter || null,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating vision:', error);
    return NextResponse.json(
      { error: 'Failed to create vision' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
