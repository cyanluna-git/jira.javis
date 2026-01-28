import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import type { SuggestionType, SuggestionStatus } from '@/types/confluence';

const VALID_SUGGESTION_TYPES: SuggestionType[] = ['merge', 'update', 'restructure', 'label', 'archive', 'split'];
const VALID_STATUSES: SuggestionStatus[] = ['pending', 'approved', 'rejected', 'applied', 'expired'];

// GET /api/confluence/suggestions - List suggestions with filters
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type');
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  const client = await pool.connect();

  try {
    // Build query with filters
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (type && VALID_SUGGESTION_TYPES.includes(type as SuggestionType)) {
      conditions.push(`s.suggestion_type = $${paramIndex++}`);
      values.push(type);
    }

    if (status && VALID_STATUSES.includes(status as SuggestionStatus)) {
      conditions.push(`s.status = $${paramIndex++}`);
      values.push(status);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // Fetch suggestions with target page details
    const suggestionsQuery = `
      SELECT
        s.*,
        (
          SELECT json_agg(json_build_object(
            'id', c.id,
            'title', c.title,
            'web_url', c.web_url
          ))
          FROM confluence_v2_content c
          WHERE c.id = ANY(s.target_page_ids)
        ) as target_pages
      FROM confluence_ai_suggestions s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const suggestionsResult = await client.query(suggestionsQuery, values);

    // Get total count
    const countQuery = `
      SELECT COUNT(*)::int as total
      FROM confluence_ai_suggestions s
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, values.slice(0, -2));

    // Get counts by type
    const byTypeResult = await client.query(`
      SELECT suggestion_type, COUNT(*)::int as count
      FROM confluence_ai_suggestions
      WHERE status = 'pending'
      GROUP BY suggestion_type
    `);

    const by_type: Record<SuggestionType, number> = {
      merge: 0, update: 0, restructure: 0, label: 0, archive: 0, split: 0
    };
    byTypeResult.rows.forEach(row => {
      by_type[row.suggestion_type as SuggestionType] = row.count;
    });

    // Get counts by status
    const byStatusResult = await client.query(`
      SELECT status, COUNT(*)::int as count
      FROM confluence_ai_suggestions
      GROUP BY status
    `);

    const by_status: Record<SuggestionStatus, number> = {
      pending: 0, approved: 0, rejected: 0, applied: 0, expired: 0
    };
    byStatusResult.rows.forEach(row => {
      by_status[row.status as SuggestionStatus] = row.count;
    });

    return NextResponse.json({
      suggestions: suggestionsResult.rows,
      total: countResult.rows[0].total,
      by_type,
      by_status,
    });
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suggestions' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/confluence/suggestions - Create a new suggestion
export async function POST(request: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await request.json();

    const {
      suggestion_type,
      target_page_ids,
      confidence_score,
      ai_reasoning,
      suggested_action,
    } = body;

    // Validate required fields
    if (!suggestion_type || !target_page_ids || !suggested_action) {
      return NextResponse.json(
        { error: 'suggestion_type, target_page_ids, and suggested_action are required' },
        { status: 400 }
      );
    }

    if (!VALID_SUGGESTION_TYPES.includes(suggestion_type)) {
      return NextResponse.json(
        { error: `Invalid suggestion_type. Must be one of: ${VALID_SUGGESTION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await client.query(`
      INSERT INTO confluence_ai_suggestions (
        suggestion_type, target_page_ids, confidence_score, ai_reasoning, suggested_action
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      suggestion_type,
      target_page_ids,
      confidence_score || null,
      ai_reasoning || null,
      JSON.stringify(suggested_action),
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to create suggestion' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
