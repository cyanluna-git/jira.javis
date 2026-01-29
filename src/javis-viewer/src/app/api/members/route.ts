import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { TeamMember, MemberRanking, CreateMemberInput } from '@/types/member';

// GET /api/members - List all members with optional filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const role = searchParams.get('role');
  const team = searchParams.get('team');
  const active = searchParams.get('active');
  const ranking = searchParams.get('ranking');

  const client = await pool.connect();

  try {
    // Use ranking view for leaderboard
    if (ranking === 'true') {
      // Only show members with:
      // 1. contribution_score > 0
      // 2. Activity within the last 1 year
      const result = await client.query(`
        WITH member_activity AS (
          SELECT
            mr.*,
            (
              SELECT MAX(ji.updated_at)
              FROM jira_issues ji
              WHERE ji.raw_data->'fields'->'assignee'->>'accountId' = mr.account_id
            ) as last_activity_at
          FROM member_ranking mr
        )
        SELECT *
        FROM member_activity
        WHERE contribution_score > 0
          AND last_activity_at IS NOT NULL
          AND last_activity_at > NOW() - INTERVAL '1 year'
        ORDER BY rank_contribution ASC
        LIMIT 50
      `);
      return NextResponse.json(result.rows);
    }

    // Regular member list with filters
    const conditions: string[] = [];
    const values: (string | boolean)[] = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (team) {
      conditions.push(`team = $${paramIndex++}`);
      values.push(team);
    }

    if (active !== null) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(active !== 'false');
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const result = await client.query<TeamMember>(`
      SELECT
        tm.*,
        ms.stories_completed,
        ms.story_points_earned,
        ms.contribution_score,
        ms.maturity_level
      FROM team_members tm
      LEFT JOIN member_stats ms ON tm.id = ms.member_id AND ms.period_type IS NULL
      ${whereClause}
      ORDER BY tm.display_name ASC
    `, values);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/members - Create a new member
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body: CreateMemberInput = await request.json();

    // Validate required fields
    if (!body.account_id || !body.display_name) {
      return NextResponse.json(
        { error: 'account_id and display_name are required' },
        { status: 400 }
      );
    }

    // Insert new member
    const result = await client.query<TeamMember>(`
      INSERT INTO team_members (
        account_id, display_name, email, avatar_url,
        role, team, skills, joined_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      body.account_id,
      body.display_name,
      body.email || null,
      body.avatar_url || null,
      body.role || 'developer',
      body.team || null,
      body.skills || null,
      body.joined_at || null
    ]);

    const newMember = result.rows[0];

    // Create initial cumulative stats row
    await client.query(`
      INSERT INTO member_stats (member_id, period_type, period_id)
      VALUES ($1, NULL, NULL)
    `, [newMember.id]);

    return NextResponse.json(newMember, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating member:', error);

    if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
      return NextResponse.json(
        { error: 'Member with this account_id already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create member' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
