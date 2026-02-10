import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface EpicIssue {
  key: string;
  summary: string;
  status: string;
  project: string;
  child_count?: number;
}

// Simple text similarity using word overlap (Jaccard-like)
function calculateSimilarity(text1: string, text2: string): number {
  const normalize = (text: string) =>
    text.toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1);

  const words1 = new Set(normalize(text1));
  const words2 = new Set(normalize(text2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union;
}

// GET /api/roadmap/epics - List Epics with optional search and AI matching
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const project = searchParams.get('project'); // e.g., 'EUV'
  const search = searchParams.get('search'); // search term
  const visionText = searchParams.get('vision_text'); // for AI matching
  const limit = parseInt(searchParams.get('limit') || '20');

  const client = await pool.connect();

  try {
    // Build query
    const conditions: string[] = [
      "raw_data->'fields'->'issuetype'->>'name' = 'Epic'"
    ];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (project) {
      conditions.push(`key LIKE $${paramIndex++} || '%'`);
      values.push(project);
    }

    if (search) {
      conditions.push(`(
        key ILIKE '%' || $${paramIndex} || '%' OR
        summary ILIKE '%' || $${paramIndex} || '%'
      )`);
      values.push(search);
      paramIndex++;
    }

    const query = `
      SELECT
        key,
        summary,
        raw_data->'fields'->'status'->>'name' as status,
        project
      FROM jira_issues
      WHERE ${conditions.join(' AND ')}
      ORDER BY key DESC
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    const result = await client.query<EpicIssue>(query, values);
    let epics = result.rows;

    // If vision_text provided, calculate similarity and sort
    if (visionText && visionText.trim()) {
      epics = epics.map(epic => ({
        ...epic,
        similarity: calculateSimilarity(visionText, `${epic.key} ${epic.summary}`),
      })).sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    }

    // Get child issue counts for each epic
    const epicKeys = epics.map(e => e.key);
    if (epicKeys.length > 0) {
      // Check if we have parent info in raw_data
      const childCountQuery = `
        SELECT
          raw_data->'fields'->'parent'->>'key' as parent_key,
          COUNT(*) as count
        FROM jira_issues
        WHERE raw_data->'fields'->'parent'->>'key' = ANY($1)
        GROUP BY raw_data->'fields'->'parent'->>'key'
      `;

      try {
        const childResult = await client.query(childCountQuery, [epicKeys]);
        const countMap: Record<string, number> = {};
        childResult.rows.forEach(row => {
          countMap[row.parent_key] = parseInt(row.count);
        });

        epics = epics.map(epic => ({
          ...epic,
          child_count: countMap[epic.key] || 0,
        }));
      } catch {
        // parent field might not exist, continue without child counts
      }
    }

    return NextResponse.json(epics);
  } catch (error) {
    console.error('Error fetching epics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epics' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// GET /api/roadmap/epics/[key]/children - Get child issues of an Epic
export async function POST(request: NextRequest) {
  // This endpoint gets children from DB (if available) or suggests to sync
  const body = await request.json();
  const epicKey = body.epic_key;

  if (!epicKey) {
    return NextResponse.json(
      { error: 'epic_key is required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    // Try to find children in DB using parent field
    const result = await client.query(`
      SELECT
        key,
        summary,
        raw_data->'fields'->'status'->>'name' as status,
        raw_data->'fields'->'issuetype'->>'name' as issue_type,
        raw_data->'fields'->'assignee'->>'displayName' as assignee
      FROM jira_issues
      WHERE raw_data->'fields'->'parent'->>'key' = $1
      ORDER BY key
    `, [epicKey]);

    if (result.rows.length > 0) {
      // Calculate progress
      const total = result.rows.length;
      const done = result.rows.filter(r =>
        ['Done', 'Closed', 'Resolved', 'Complete', 'Completed'].includes(r.status)
      ).length;
      const inProgress = result.rows.filter(r =>
        ['In Progress', 'In Review', 'Testing'].includes(r.status)
      ).length;

      const progress = ((done * 100) + (inProgress * 50)) / total;

      return NextResponse.json({
        epic_key: epicKey,
        source: 'database',
        children: result.rows,
        stats: {
          total,
          done,
          in_progress: inProgress,
          todo: total - done - inProgress,
          progress_percent: Math.round(progress * 100) / 100,
        }
      });
    }

    // No children found in DB
    return NextResponse.json({
      epic_key: epicKey,
      source: 'none',
      children: [],
      message: 'No children found in database. Use Sync to fetch from Jira API.',
    });
  } catch (error) {
    console.error('Error fetching epic children:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epic children' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
