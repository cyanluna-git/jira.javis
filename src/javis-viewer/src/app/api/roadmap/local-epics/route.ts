import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';

// GET /api/roadmap/local-epics - List all local epics
// GET /api/roadmap/local-epics?milestone_id=xxx - List by milestone
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const milestoneId = searchParams.get('milestone_id');

  try {
    let query = `
      SELECT
        le.id,
        le.milestone_id,
        le.title,
        le.description,
        le.assignee,
        le.priority,
        le.status,
        le.jira_key,
        le.story_points,
        le.sort_order,
        le.created_at,
        le.updated_at,
        m.title as milestone_title
      FROM roadmap_local_epics le
      LEFT JOIN roadmap_milestones m ON m.id = le.milestone_id
    `;
    const params: string[] = [];

    if (milestoneId) {
      query += ` WHERE le.milestone_id = $1`;
      params.push(milestoneId);
    }

    query += ` ORDER BY le.sort_order, le.created_at`;

    const result = await pool.query(query, params);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching local epics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch local epics' },
      { status: 500 }
    );
  }
}

// POST /api/roadmap/local-epics - Create a new local epic
export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  try {
    const body = await request.json();
    const {
      milestone_id,
      title,
      description,
      assignee,
      priority = 'Medium',
      story_points,
      sort_order = 0,
    } = body;

    if (!milestone_id || !title) {
      return NextResponse.json(
        { error: 'milestone_id and title are required' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `INSERT INTO roadmap_local_epics
        (milestone_id, title, description, assignee, priority, story_points, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [milestone_id, title, description, assignee, priority, story_points, sort_order]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating local epic:', error);
    return NextResponse.json(
      { error: 'Failed to create local epic' },
      { status: 500 }
    );
  }
}
