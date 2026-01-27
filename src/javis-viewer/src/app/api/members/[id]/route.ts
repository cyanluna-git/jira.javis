import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { TeamMember, MemberDetail, UpdateMemberInput } from '@/types/member';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/members/[id] - Get member detail with stats
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Get member
    const memberResult = await client.query<TeamMember>(`
      SELECT * FROM team_members WHERE id = $1
    `, [id]);

    if (memberResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    const member = memberResult.rows[0];

    // Get cumulative stats
    const cumulativeResult = await client.query(`
      SELECT * FROM member_stats
      WHERE member_id = $1 AND period_type IS NULL
    `, [id]);

    // Get sprint stats (recent 10)
    const sprintResult = await client.query(`
      SELECT ms.*, js.name as sprint_name
      FROM member_stats ms
      LEFT JOIN jira_sprints js ON ms.period_id = js.id::text
      WHERE ms.member_id = $1 AND ms.period_type = 'sprint'
      ORDER BY ms.calculated_at DESC
      LIMIT 10
    `, [id]);

    // Get recent history
    const historyResult = await client.query(`
      SELECT * FROM member_stat_history
      WHERE member_id = $1
      ORDER BY created_at DESC
      LIMIT 20
    `, [id]);

    // Get evaluations
    const evalResult = await client.query(`
      SELECT * FROM manager_evaluations
      WHERE member_id = $1
      ORDER BY evaluated_at DESC
      LIMIT 10
    `, [id]);

    const detail: MemberDetail = {
      member,
      cumulative_stats: cumulativeResult.rows[0] || null,
      sprint_stats: sprintResult.rows,
      recent_history: historyResult.rows,
      evaluations: evalResult.rows
    };

    return NextResponse.json(detail);
  } catch (error) {
    console.error('Error fetching member detail:', error);
    return NextResponse.json(
      { error: 'Failed to fetch member detail' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PATCH /api/members/[id] - Update member info
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const body: UpdateMemberInput = await request.json();

    // Allowed fields to update
    const allowedFields = ['display_name', 'email', 'role', 'team', 'skills', 'is_active'];
    const updates: string[] = [];
    const values: (string | string[] | boolean)[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add updated_at and id
    updates.push('updated_at = NOW()');
    values.push(id);

    const result = await client.query<TeamMember>(`
      UPDATE team_members
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating member:', error);
    return NextResponse.json(
      { error: 'Failed to update member' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE /api/members/[id] - Soft delete (set is_active = false)
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const result = await client.query<TeamMember>(`
      UPDATE team_members
      SET is_active = FALSE, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Member deactivated', member: result.rows[0] });
  } catch (error) {
    console.error('Error deleting member:', error);
    return NextResponse.json(
      { error: 'Failed to delete member' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
