import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

type TargetType = 'jira_issue' | 'confluence_page';

const TARGET_TYPE_MAP: Record<TargetType, { product: string; entityTypes: string[] }> = {
  jira_issue: { product: 'jira', entityTypes: ['issue'] },
  confluence_page: { product: 'confluence', entityTypes: ['page', 'suggestion'] },
};

/**
 * GET /api/audit/writes
 * Query params:
 *   target_type: 'jira_issue' | 'confluence_page'
 *   target_id:   issue key or page id
 *   limit:       number (default 20, max 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const targetType = searchParams.get('target_type') as TargetType | null;
  const targetId = searchParams.get('target_id');
  const limitRaw = parseInt(searchParams.get('limit') ?? '20', 10);
  const limit = Math.min(isNaN(limitRaw) ? 20 : limitRaw, 100);

  if (!targetType || !TARGET_TYPE_MAP[targetType]) {
    return NextResponse.json(
      { error: 'target_type must be jira_issue or confluence_page' },
      { status: 400 }
    );
  }

  if (!targetId || targetId.trim() === '') {
    return NextResponse.json(
      { error: 'target_id is required' },
      { status: 400 }
    );
  }

  const { product, entityTypes } = TARGET_TYPE_MAP[targetType];

  try {
    const result = await pool.query(
      `
        SELECT id, created_at, app_user_key, app_user_name, app_user_email,
               action, entity_id, entity_type, product, payload
        FROM external_write_audit_log
        WHERE product = $1
          AND entity_id = $2
          AND entity_type = ANY($3::text[])
        ORDER BY created_at DESC
        LIMIT $4
      `,
      [product, targetId, entityTypes, limit]
    );
    return NextResponse.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('audit/writes query error:', err);
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to fetch audit log' } },
      { status: 500 }
    );
  }
}
