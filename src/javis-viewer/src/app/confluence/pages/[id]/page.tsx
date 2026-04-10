import { notFound } from 'next/navigation';
import pool from '@/lib/db';
import ConfluenceFullPage from './ConfluenceFullPage';
import type { ConfluencePage, ConfluenceBreadcrumb } from '@/types/confluence';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ConfluencePageRoute({ params }: PageProps) {
  const { id } = await params;
  const client = await pool.connect();

  let page: ConfluencePage | null = null;
  let breadcrumbs: ConfluenceBreadcrumb[] = [];

  try {
    const pageResult = await client.query<ConfluencePage>(
      `SELECT id, type, title, parent_id, space_id, labels,
              body_storage, version, web_url, created_at, last_synced_at,
              materialized_path, depth, child_count, is_orphan, orphan_reason, sort_order
       FROM confluence_v2_content
       WHERE id = $1`,
      [id]
    );

    if (pageResult.rows.length === 0) {
      notFound();
    }

    page = pageResult.rows[0];

    const breadcrumbsResult = await client.query<ConfluenceBreadcrumb>(
      `WITH RECURSIVE ancestors AS (
         SELECT id, title, parent_id, depth
         FROM confluence_v2_content
         WHERE id = $1
         UNION ALL
         SELECT c.id, c.title, c.parent_id, c.depth
         FROM confluence_v2_content c
         JOIN ancestors a ON c.id = a.parent_id
         WHERE a.parent_id IS NOT NULL
       )
       SELECT id, title, depth
       FROM ancestors
       WHERE id != $1
       ORDER BY depth ASC`,
      [id]
    );

    breadcrumbs = breadcrumbsResult.rows;
  } catch (error) {
    console.error('Error fetching confluence page:', error);
    notFound();
  } finally {
    client.release();
  }

  return <ConfluenceFullPage page={page!} breadcrumbs={breadcrumbs} />;
}
