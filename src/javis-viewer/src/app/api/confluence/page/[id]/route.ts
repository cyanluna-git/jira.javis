import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';

// GET /api/confluence/page/[id] - Get page content with breadcrumbs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const client = await pool.connect();

  try {
    // Fetch page
    const pageResult = await client.query<ConfluencePage>(`
      SELECT
        id, type, title, parent_id, space_id, labels,
        body_storage, version, web_url, created_at, last_synced_at,
        materialized_path, depth, child_count, is_orphan, orphan_reason, sort_order
      FROM confluence_v2_content
      WHERE id = $1
    `, [id]);

    if (pageResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Page not found' },
        { status: 404 }
      );
    }

    const page = pageResult.rows[0];

    // Fetch breadcrumbs (ancestors) using recursive CTE
    const breadcrumbsResult = await client.query<ConfluenceBreadcrumb>(`
      WITH RECURSIVE ancestors AS (
        -- Start from immediate parent
        SELECT id, title, parent_id, depth
        FROM confluence_v2_content
        WHERE id = $1

        UNION ALL

        -- Recursively get parents
        SELECT c.id, c.title, c.parent_id, c.depth
        FROM confluence_v2_content c
        JOIN ancestors a ON c.id = a.parent_id
        WHERE a.parent_id IS NOT NULL
      )
      SELECT id, title, depth
      FROM ancestors
      WHERE id != $1
      ORDER BY depth ASC
    `, [id]);

    return NextResponse.json({
      page,
      breadcrumbs: breadcrumbsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching confluence page:', error);
    return NextResponse.json(
      { error: 'Failed to fetch page' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
