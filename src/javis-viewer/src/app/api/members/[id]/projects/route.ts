import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Decode URL-encoded accountId (Jira accountIds often have special characters)
function decodeAccountId(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

// GET /api/members/[id]/projects - Get all projects for a member
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const accountId = decodeAccountId(id);
  const client = await pool.connect();

  try {
    // Verify member exists
    const memberCheck = await client.query(
      'SELECT account_id, display_name, avatar_url FROM team_members WHERE account_id = $1',
      [accountId]
    );
    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const member = memberCheck.rows[0];

    // Get all project roles for this member
    const result = await client.query(`
      SELECT
        vm.id,
        vm.vision_id,
        vm.role_title,
        vm.role_category,
        vm.role_description,
        vm.mm_allocation,
        vm.start_date,
        vm.end_date,
        vm.created_at,
        vm.updated_at,
        v.title as vision_title,
        v.project_key,
        v.status as vision_status
      FROM roadmap_vision_members vm
      JOIN roadmap_visions v ON v.id = vm.vision_id
      WHERE vm.member_account_id = $1
      ORDER BY
        CASE v.status
          WHEN 'active' THEN 1
          WHEN 'achieved' THEN 2
          WHEN 'archived' THEN 3
        END,
        v.title ASC
    `, [accountId]);

    // Calculate summary
    const projects = result.rows;
    const totalMM = projects.reduce((sum, p) => sum + (Number(p.mm_allocation) || 0), 0);
    const activeProjects = projects.filter(p => p.vision_status === 'active');

    return NextResponse.json({
      member: {
        account_id: member.account_id,
        display_name: member.display_name,
        avatar_url: member.avatar_url,
      },
      projects,
      summary: {
        total_projects: projects.length,
        active_projects: activeProjects.length,
        total_mm_allocation: totalMM,
      },
    });
  } catch (error) {
    console.error('Error fetching member projects:', error);
    return NextResponse.json({ error: 'Failed to fetch member projects' }, { status: 500 });
  } finally {
    client.release();
  }
}
