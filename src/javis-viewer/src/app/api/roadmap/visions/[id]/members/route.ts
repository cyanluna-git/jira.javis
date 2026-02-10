import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';
import type { VisionMember, CreateVisionMemberInput, UpdateVisionMemberInput } from '@/types/roadmap';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/roadmap/visions/[id]/members - List all members for a vision
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: visionId } = await params;
  const client = await pool.connect();

  try {
    // Verify vision exists
    const visionCheck = await client.query(
      'SELECT id FROM roadmap_visions WHERE id = $1',
      [visionId]
    );
    if (visionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Vision not found' }, { status: 404 });
    }

    // Get members with team_members join
    const result = await client.query<VisionMember>(`
      SELECT
        vm.id,
        vm.vision_id,
        vm.member_account_id,
        vm.role_title,
        vm.role_category,
        vm.role_description,
        vm.mm_allocation,
        vm.start_date,
        vm.end_date,
        vm.created_at,
        vm.updated_at,
        tm.display_name,
        tm.avatar_url,
        tm.email,
        tm.role as company_role,
        tm.team,
        tm.skills
      FROM roadmap_vision_members vm
      JOIN team_members tm ON tm.account_id = vm.member_account_id
      WHERE vm.vision_id = $1
      ORDER BY
        CASE vm.role_category
          WHEN 'pm' THEN 1
          WHEN 'fullstack' THEN 2
          WHEN 'backend' THEN 3
          WHEN 'frontend' THEN 4
          WHEN 'plc' THEN 5
          WHEN 'devops' THEN 6
          WHEN 'qa' THEN 7
          WHEN 'scenario' THEN 8
          ELSE 9
        END,
        tm.display_name ASC
    `, [visionId]);

    // Calculate summary stats
    const members = result.rows;
    const totalMM = members.reduce((sum, m) => sum + (Number(m.mm_allocation) || 0), 0);

    return NextResponse.json({
      members,
      summary: {
        member_count: members.length,
        total_mm_allocation: totalMM,
      },
    });
  } catch (error) {
    console.error('Error fetching vision members:', error);
    return NextResponse.json({ error: 'Failed to fetch vision members' }, { status: 500 });
  } finally {
    client.release();
  }
}

// POST /api/roadmap/visions/[id]/members - Add a member to the vision
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id: visionId } = await params;
  const client = await pool.connect();

  try {
    const body: CreateVisionMemberInput = await request.json();

    // Validate required fields
    if (!body.member_account_id || !body.role_title) {
      return NextResponse.json(
        { error: 'member_account_id and role_title are required' },
        { status: 400 }
      );
    }

    // Verify vision exists
    const visionCheck = await client.query(
      'SELECT id FROM roadmap_visions WHERE id = $1',
      [visionId]
    );
    if (visionCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Vision not found' }, { status: 404 });
    }

    // Verify member exists
    const memberCheck = await client.query(
      'SELECT account_id FROM team_members WHERE account_id = $1',
      [body.member_account_id]
    );
    if (memberCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Insert or update (upsert)
    const result = await client.query<VisionMember>(`
      INSERT INTO roadmap_vision_members (
        vision_id, member_account_id, role_title, role_category,
        role_description, mm_allocation, start_date, end_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (vision_id, member_account_id)
      DO UPDATE SET
        role_title = EXCLUDED.role_title,
        role_category = COALESCE(EXCLUDED.role_category, roadmap_vision_members.role_category),
        role_description = COALESCE(EXCLUDED.role_description, roadmap_vision_members.role_description),
        mm_allocation = COALESCE(EXCLUDED.mm_allocation, roadmap_vision_members.mm_allocation),
        start_date = COALESCE(EXCLUDED.start_date, roadmap_vision_members.start_date),
        end_date = COALESCE(EXCLUDED.end_date, roadmap_vision_members.end_date),
        updated_at = NOW()
      RETURNING *
    `, [
      visionId,
      body.member_account_id,
      body.role_title,
      body.role_category || null,
      body.role_description || null,
      body.mm_allocation || null,
      body.start_date || null,
      body.end_date || null,
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error adding vision member:', error);
    return NextResponse.json({ error: 'Failed to add vision member' }, { status: 500 });
  } finally {
    client.release();
  }
}

// PUT /api/roadmap/visions/[id]/members - Update a member (uses member_account_id from body)
export async function PUT(request: NextRequest, { params }: RouteParams) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id: visionId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const memberAccountId = searchParams.get('member_account_id');
  const client = await pool.connect();

  try {
    if (!memberAccountId) {
      return NextResponse.json(
        { error: 'member_account_id query parameter is required' },
        { status: 400 }
      );
    }

    const body: UpdateVisionMemberInput = await request.json();

    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIndex = 1;

    if (body.role_title !== undefined) {
      updates.push(`role_title = $${paramIndex++}`);
      values.push(body.role_title);
    }
    if (body.role_category !== undefined) {
      updates.push(`role_category = $${paramIndex++}`);
      values.push(body.role_category);
    }
    if (body.role_description !== undefined) {
      updates.push(`role_description = $${paramIndex++}`);
      values.push(body.role_description);
    }
    if (body.mm_allocation !== undefined) {
      updates.push(`mm_allocation = $${paramIndex++}`);
      values.push(body.mm_allocation);
    }
    if (body.start_date !== undefined) {
      updates.push(`start_date = $${paramIndex++}`);
      values.push(body.start_date);
    }
    if (body.end_date !== undefined) {
      updates.push(`end_date = $${paramIndex++}`);
      values.push(body.end_date);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(visionId, memberAccountId);
    const result = await client.query<VisionMember>(`
      UPDATE roadmap_vision_members
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE vision_id = $${paramIndex++} AND member_account_id = $${paramIndex}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found in this vision' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating vision member:', error);
    return NextResponse.json({ error: 'Failed to update vision member' }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE /api/roadmap/visions/[id]/members - Remove a member
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id: visionId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const memberAccountId = searchParams.get('member_account_id');
  const client = await pool.connect();

  try {
    if (!memberAccountId) {
      return NextResponse.json(
        { error: 'member_account_id query parameter is required' },
        { status: 400 }
      );
    }

    const result = await client.query(`
      DELETE FROM roadmap_vision_members
      WHERE vision_id = $1 AND member_account_id = $2
      RETURNING id
    `, [visionId, memberAccountId]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Member not found in this vision' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing vision member:', error);
    return NextResponse.json({ error: 'Failed to remove vision member' }, { status: 500 });
  } finally {
    client.release();
  }
}
