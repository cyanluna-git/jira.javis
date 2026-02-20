import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { PoolClient } from 'pg';
import type { ConfluenceTreeNode, TreeResponse, TreeStats } from '@/types/confluence';

// GET /api/confluence/tree - Fetch tree structure with lazy loading support
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const parentId = searchParams.get('parent_id');
  const depth = parseInt(searchParams.get('depth') || '1', 10);
  const includeOrphans = searchParams.get('include_orphans') === 'true';
  const statsOnly = searchParams.get('stats') === 'true';
  const searchQuery = searchParams.get('search');

  const client = await pool.connect();

  try {
    // Return tree statistics only
    if (statsOnly) {
      const result = await client.query<TreeStats>(`
        SELECT
          COUNT(*)::int as total_pages,
          COUNT(*) FILTER (WHERE is_orphan)::int as total_orphans,
          MAX(depth)::int as max_depth,
          ROUND(AVG(depth)::numeric, 2) as avg_depth,
          COUNT(*) FILTER (WHERE child_count > 0)::int as pages_with_children
        FROM confluence_v2_content
      `);
      return NextResponse.json(result.rows[0]);
    }

    // Handle search query - search database for matching pages
    if (searchQuery && searchQuery.trim().length >= 2) {
      const searchPattern = `%${searchQuery.replace(/[%_\\]/g, '\\$&')}%`;

      // Search using FTS and trigram similarity
      const searchResult = await client.query(`
        SELECT
          id, title, type, parent_id, depth, child_count, is_orphan, sort_order,
          ts_rank(search_vector, plainto_tsquery('simple', $1)) as fts_rank,
          similarity(title, $1) as sim
        FROM confluence_v2_content
        WHERE
          type = 'page'
          AND title NOT ILIKE 'Archived%'
          AND NOT ('archived' = ANY(labels))
          AND (
            search_vector @@ plainto_tsquery('simple', $1)
            OR similarity(title, $1) > 0.1
            OR title ILIKE $2
          )
        ORDER BY
          CASE WHEN title ILIKE $2 THEN 0 ELSE 1 END,
          GREATEST(ts_rank(search_vector, plainto_tsquery('simple', $1)), similarity(title, $1)) DESC,
          title
        LIMIT 50
      `, [searchQuery, searchPattern]);

      const nodes: ConfluenceTreeNode[] = searchResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type,
        parent_id: row.parent_id,
        depth: row.depth,
        child_count: row.child_count,
        is_orphan: row.is_orphan,
        children: [],
      }));

      return NextResponse.json({
        nodes,
        total_count: searchResult.rowCount || 0,
        orphan_count: 0,
        is_search_result: true,
      });
    }

    let nodes: ConfluenceTreeNode[] = [];

    if (parentId === null || parentId === 'null' || parentId === '') {
      // Fetch root nodes (no parent or orphan roots)
      // Exclude archived pages: title starts with "Archived" or has 'archived' label
      const rootQuery = includeOrphans
        ? `
          SELECT id, title, type, parent_id, depth, child_count, is_orphan, sort_order
          FROM confluence_v2_content
          WHERE (parent_id IS NULL OR is_orphan = TRUE)
            AND title NOT ILIKE 'Archived%'
            AND NOT ('archived' = ANY(labels))
          ORDER BY is_orphan, sort_order, title
        `
        : `
          SELECT id, title, type, parent_id, depth, child_count, is_orphan, sort_order
          FROM confluence_v2_content
          WHERE parent_id IS NULL AND is_orphan = FALSE
            AND title NOT ILIKE 'Archived%'
            AND NOT ('archived' = ANY(labels))
          ORDER BY sort_order, title
        `;

      const rootResult = await client.query(rootQuery);
      nodes = rootResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        type: row.type,
        parent_id: row.parent_id,
        depth: row.depth,
        child_count: row.child_count,
        is_orphan: row.is_orphan,
        children: [],
      }));

      // If depth > 1, recursively fetch children
      if (depth > 1) {
        await fetchChildrenRecursive(client, nodes, depth - 1);
      }
    } else {
      // Fetch children of specific parent with recursive CTE
      // Exclude archived pages: title starts with "Archived" or has 'archived' label
      const childQuery = `
        WITH RECURSIVE tree AS (
          -- Base case: direct children
          SELECT
            id, title, type, parent_id, depth, child_count, is_orphan, sort_order,
            1 as level
          FROM confluence_v2_content
          WHERE parent_id = $1
            AND title NOT ILIKE 'Archived%'
            AND NOT ('archived' = ANY(labels))

          UNION ALL

          -- Recursive case: grandchildren up to max depth
          SELECT
            c.id, c.title, c.type, c.parent_id, c.depth, c.child_count, c.is_orphan, c.sort_order,
            t.level + 1
          FROM confluence_v2_content c
          JOIN tree t ON c.parent_id = t.id
          WHERE t.level < $2
            AND c.title NOT ILIKE 'Archived%'
            AND NOT ('archived' = ANY(c.labels))
        )
        SELECT * FROM tree
        ORDER BY level, sort_order, title
      `;

      const childResult = await client.query(childQuery, [parentId, depth]);
      nodes = buildTreeFromFlat(childResult.rows, parentId);
    }

    // Get counts for response
    const countResult = await client.query(`
      SELECT
        COUNT(*)::int as total_count,
        COUNT(*) FILTER (WHERE is_orphan)::int as orphan_count
      FROM confluence_v2_content
    `);

    const response: TreeResponse = {
      nodes,
      total_count: countResult.rows[0].total_count,
      orphan_count: countResult.rows[0].orphan_count,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching confluence tree:', error);
    return NextResponse.json(
      { error: 'Failed to fetch confluence tree' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// Helper: Recursively fetch children for nodes
async function fetchChildrenRecursive(
  client: PoolClient,
  nodes: ConfluenceTreeNode[],
  remainingDepth: number
): Promise<void> {
  if (remainingDepth <= 0 || nodes.length === 0) return;

  const nodeIds = nodes.filter(n => n.child_count > 0).map(n => n.id);
  if (nodeIds.length === 0) return;

  // Exclude archived pages: title starts with "Archived" or has 'archived' label
  const childQuery = `
    SELECT id, title, type, parent_id, depth, child_count, is_orphan, sort_order
    FROM confluence_v2_content
    WHERE parent_id = ANY($1)
      AND title NOT ILIKE 'Archived%'
      AND NOT ('archived' = ANY(labels))
    ORDER BY sort_order, title
  `;

  const childResult = await client.query(childQuery, [nodeIds]);
  const childrenByParent = new Map<string, ConfluenceTreeNode[]>();

  for (const row of childResult.rows) {
    const child: ConfluenceTreeNode = {
      id: row.id,
      title: row.title,
      type: row.type,
      parent_id: row.parent_id,
      depth: row.depth,
      child_count: row.child_count,
      is_orphan: row.is_orphan,
      children: [],
    };

    if (!childrenByParent.has(row.parent_id)) {
      childrenByParent.set(row.parent_id, []);
    }
    childrenByParent.get(row.parent_id)!.push(child);
  }

  // Assign children to nodes
  for (const node of nodes) {
    node.children = childrenByParent.get(node.id) || [];
  }

  // Recursively fetch grandchildren
  const allChildren = nodes.flatMap(n => n.children);
  await fetchChildrenRecursive(client, allChildren, remainingDepth - 1);
}

// Helper: Build tree structure from flat result
function buildTreeFromFlat(
  rows: Array<{
    id: string;
    title: string;
    type: string;
    parent_id: string;
    depth: number;
    child_count: number;
    is_orphan: boolean;
    level: number;
  }>,
  rootParentId: string
): ConfluenceTreeNode[] {
  const nodeMap = new Map<string, ConfluenceTreeNode>();
  const roots: ConfluenceTreeNode[] = [];

  // Create all nodes first
  for (const row of rows) {
    nodeMap.set(row.id, {
      id: row.id,
      title: row.title,
      type: row.type as 'page' | 'folder',
      parent_id: row.parent_id,
      depth: row.depth,
      child_count: row.child_count,
      is_orphan: row.is_orphan,
      children: [],
    });
  }

  // Build tree structure
  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parent_id === rootParentId) {
      roots.push(node);
    } else {
      const parent = nodeMap.get(row.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    }
  }

  return roots;
}
