import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { MemberStatHistory } from '@/types/member';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/members/[id]/history - Get stat change history
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50');
  const triggerType = searchParams.get('trigger_type');
  const statName = searchParams.get('stat_name');

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const conditions: string[] = ['member_id = $1'];
    const values: (string | number)[] = [id];
    let paramIndex = 2;

    if (triggerType) {
      conditions.push(`trigger_type = $${paramIndex++}`);
      values.push(triggerType);
    }

    if (statName) {
      conditions.push(`stat_name = $${paramIndex++}`);
      values.push(statName);
    }

    values.push(Math.min(limit, 200)); // Max 200

    const result = await client.query<MemberStatHistory>(`
      SELECT * FROM member_stat_history
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex}
    `, values);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching stat history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
