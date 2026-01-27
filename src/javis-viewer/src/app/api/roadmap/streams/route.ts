import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Stream, CreateStreamInput } from '@/types/roadmap';

// POST /api/roadmap/streams - Create a new stream
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body: CreateStreamInput = await request.json();

    if (!body.milestone_id || !body.name || !body.category) {
      return NextResponse.json(
        { error: 'milestone_id, name, and category are required' },
        { status: 400 }
      );
    }

    // Verify milestone exists
    const milestoneCheck = await client.query(
      'SELECT id FROM roadmap_milestones WHERE id = $1',
      [body.milestone_id]
    );
    if (milestoneCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    const result = await client.query<Stream>(`
      INSERT INTO roadmap_streams (
        milestone_id, name, category, color, owner_account_id
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      body.milestone_id,
      body.name,
      body.category,
      body.color || null,
      body.owner_account_id || null,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating stream:', error);
    return NextResponse.json(
      { error: 'Failed to create stream' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
