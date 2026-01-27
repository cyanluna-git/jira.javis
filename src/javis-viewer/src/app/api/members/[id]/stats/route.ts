import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { MemberStats, UpdateStatsInput } from '@/types/member';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/members/[id]/stats - Get member stats
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const periodType = searchParams.get('period_type'); // 'sprint', 'month', etc.
  const periodId = searchParams.get('period_id');

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Check member exists
    const memberCheck = await client.query(
      'SELECT id FROM team_members WHERE id = $1',
      [id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    let query: string;
    let values: (string | null)[];

    if (periodType && periodId) {
      // Get specific period stats
      query = `
        SELECT * FROM member_stats
        WHERE member_id = $1 AND period_type = $2 AND period_id = $3
      `;
      values = [id, periodType, periodId];
    } else if (periodType) {
      // Get all stats for a period type
      query = `
        SELECT ms.*, js.name as sprint_name
        FROM member_stats ms
        LEFT JOIN jira_sprints js ON ms.period_type = 'sprint' AND ms.period_id = js.id::text
        WHERE ms.member_id = $1 AND ms.period_type = $2
        ORDER BY ms.calculated_at DESC
      `;
      values = [id, periodType];
    } else {
      // Get cumulative stats (period_type IS NULL)
      query = `
        SELECT * FROM member_stats
        WHERE member_id = $1 AND period_type IS NULL
      `;
      values = [id];
    }

    const result = await client.query<MemberStats>(query, values);

    if (periodType && periodId) {
      return NextResponse.json(result.rows[0] || null);
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching member stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PATCH /api/members/[id]/stats - Update member stats (manual adjustment)
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const changedBy = searchParams.get('changed_by') || 'manual';

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const body: UpdateStatsInput & { reason?: string } = await request.json();

    // Allowed fields to manually update
    const allowedFields = [
      'reviews_given', 'reviews_received', 'tests_written', 'docs_written',
      'bugs_introduced', 'rework_count', 'development_score', 'review_score',
      'testing_score', 'collaboration_score', 'maturity_level'
    ];

    // Get current stats first (for history)
    const currentResult = await client.query<MemberStats>(`
      SELECT * FROM member_stats
      WHERE member_id = $1 AND period_type IS NULL
    `, [id]);

    if (currentResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member stats not found' },
        { status: 404 }
      );
    }

    const currentStats = currentResult.rows[0];
    const updates: string[] = [];
    const values: (string | number)[] = [];
    const historyRecords: Array<{
      stat_name: string;
      old_value: number;
      new_value: number;
    }> = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(body)) {
      if (allowedFields.includes(key) && value !== undefined) {
        const oldValue = currentStats[key as keyof MemberStats] as number;
        const newValue = typeof value === 'number' ? value : parseFloat(value);

        if (oldValue !== newValue) {
          updates.push(`${key} = $${paramIndex++}`);
          values.push(newValue);
          historyRecords.push({
            stat_name: key,
            old_value: oldValue || 0,
            new_value: newValue
          });
        }
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid stat changes provided' },
        { status: 400 }
      );
    }

    // Add calculated_at
    updates.push('calculated_at = NOW()');
    values.push(id);

    // Update stats
    const result = await client.query<MemberStats>(`
      UPDATE member_stats
      SET ${updates.join(', ')}
      WHERE member_id = $${paramIndex} AND period_type IS NULL
      RETURNING *
    `, values);

    // Record history for each change
    for (const record of historyRecords) {
      await client.query(`
        INSERT INTO member_stat_history
        (member_id, trigger_type, trigger_ref, stat_name, old_value, new_value, delta, changed_by, reason)
        VALUES ($1, 'manual', $2, $3, $4, $5, $6, $7, $8)
      `, [
        id,
        body.reason || 'Manual adjustment',
        record.stat_name,
        record.old_value,
        record.new_value,
        record.new_value - record.old_value,
        changedBy,
        body.reason || null
      ]);
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating member stats:', error);
    return NextResponse.json(
      { error: 'Failed to update stats' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
