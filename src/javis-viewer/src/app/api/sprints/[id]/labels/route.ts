import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { Sprint } from '@/types/sprint';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sprints/:id/labels - Get sprint with confluence_labels
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const result = await client.query<Sprint>(`
      SELECT id, board_id, name, state, goal, start_date, end_date, confluence_labels
      FROM jira_sprints
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching sprint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sprint' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PUT /api/sprints/:id/labels - Update sprint confluence_labels
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    const body = await request.json();
    const { labels } = body as { labels: string[] };

    if (!Array.isArray(labels)) {
      return NextResponse.json(
        { error: 'labels must be an array' },
        { status: 400 }
      );
    }

    // Sanitize labels: trim whitespace, filter empty, lowercase
    const sanitizedLabels = labels
      .map(l => l.trim().toLowerCase())
      .filter(l => l.length > 0);

    const result = await client.query<Sprint>(`
      UPDATE jira_sprints
      SET confluence_labels = $1
      WHERE id = $2
      RETURNING id, board_id, name, state, goal, start_date, end_date, confluence_labels
    `, [sanitizedLabels, id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sprint not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ sprint: result.rows[0] });
  } catch (error) {
    console.error('Error updating sprint labels:', error);
    return NextResponse.json(
      { error: 'Failed to update sprint labels' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
