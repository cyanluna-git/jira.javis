import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { ConfluencePage } from '@/types/confluence';

// GET /api/confluence/by-labels?labels=scaled-sprint14,EUVGen4
// Returns pages that have ANY of the specified labels
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const labelsParam = searchParams.get('labels');

  if (!labelsParam) {
    return NextResponse.json(
      { error: 'labels parameter is required' },
      { status: 400 }
    );
  }

  const labels = labelsParam.split(',').map(l => l.trim()).filter(Boolean);

  if (labels.length === 0) {
    return NextResponse.json(
      { error: 'At least one label is required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Use PostgreSQL array overlap operator (&&) to find pages with any matching label
    const result = await client.query<ConfluencePage>(`
      SELECT
        id, type, title, parent_id, space_id, labels,
        body_storage, version, web_url, created_at, last_synced_at,
        materialized_path, depth, child_count, is_orphan, orphan_reason, sort_order
      FROM confluence_v2_content
      WHERE type = 'page'
        AND labels && $1::text[]
      ORDER BY created_at DESC
      LIMIT 50
    `, [labels]);

    return NextResponse.json({
      pages: result.rows,
      total: result.rows.length,
      labels,
    });
  } catch (error) {
    console.error('Error fetching confluence pages by labels:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pages' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
