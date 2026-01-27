import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { EpicLink, LinkEpicInput, Stream, CreateStreamInput } from '@/types/roadmap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/milestones/[id]/epics - List epic links for a milestone
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const result = await client.query<EpicLink>(`
      SELECT e.*, s.name as stream_name, s.category as stream_category
      FROM roadmap_epic_links e
      LEFT JOIN roadmap_streams s ON s.id = e.stream_id
      WHERE e.milestone_id = $1
      ORDER BY e.created_at DESC
    `, [id]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching epic links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epic links' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/roadmap/milestones/[id]/epics - Link an epic to the milestone
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body: LinkEpicInput = await request.json();

    if (!body.epic_key) {
      return NextResponse.json(
        { error: 'epic_key is required' },
        { status: 400 }
      );
    }

    // Verify milestone exists
    const milestoneCheck = await client.query(
      'SELECT id FROM roadmap_milestones WHERE id = $1',
      [id]
    );
    if (milestoneCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Milestone not found' },
        { status: 404 }
      );
    }

    // If stream_id provided, verify it belongs to this milestone
    if (body.stream_id) {
      const streamCheck = await client.query(
        'SELECT id FROM roadmap_streams WHERE id = $1 AND milestone_id = $2',
        [body.stream_id, id]
      );
      if (streamCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Stream not found or does not belong to this milestone' },
          { status: 400 }
        );
      }
    }

    const result = await client.query<EpicLink>(`
      INSERT INTO roadmap_epic_links (milestone_id, stream_id, epic_key)
      VALUES ($1, $2, $3)
      ON CONFLICT (milestone_id, epic_key)
      DO UPDATE SET stream_id = EXCLUDED.stream_id
      RETURNING *
    `, [id, body.stream_id || null, body.epic_key]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error linking epic:', error);
    return NextResponse.json(
      { error: 'Failed to link epic' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// DELETE /api/roadmap/milestones/[id]/epics - Unlink an epic
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const epicKey = searchParams.get('epic_key');

  if (!epicKey) {
    return NextResponse.json(
      { error: 'epic_key query parameter is required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const result = await client.query<EpicLink>(`
      DELETE FROM roadmap_epic_links
      WHERE milestone_id = $1 AND epic_key = $2
      RETURNING *
    `, [id, epicKey]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Epic link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Error unlinking epic:', error);
    return NextResponse.json(
      { error: 'Failed to unlink epic' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
