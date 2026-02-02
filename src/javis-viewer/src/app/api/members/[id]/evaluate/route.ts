import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';
import type { ManagerEvaluation, CreateEvaluationInput } from '@/types/member';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/members/[id]/evaluate - Get evaluations for a member
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period');

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    let query: string;
    let values: string[];

    if (period) {
      query = `
        SELECT * FROM manager_evaluations
        WHERE member_id = $1 AND evaluation_period = $2
      `;
      values = [id, period];
    } else {
      query = `
        SELECT * FROM manager_evaluations
        WHERE member_id = $1
        ORDER BY evaluated_at DESC
      `;
      values = [id];
    }

    const result = await client.query<ManagerEvaluation>(query, values);

    if (period) {
      return NextResponse.json(result.rows[0] || null);
    }

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching evaluations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch evaluations' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/members/[id]/evaluate - Create or update evaluation
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const { id } = await context.params;
  const searchParams = request.nextUrl.searchParams;
  const evaluatedBy = searchParams.get('evaluated_by');

  if (!UUID_REGEX.test(id)) {
    return NextResponse.json(
      { error: 'Invalid member ID format' },
      { status: 400 }
    );
  }

  if (!evaluatedBy) {
    return NextResponse.json(
      { error: 'evaluated_by query parameter is required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const body: CreateEvaluationInput = await request.json();

    // Validate required fields
    if (!body.evaluation_period) {
      return NextResponse.json(
        { error: 'evaluation_period is required' },
        { status: 400 }
      );
    }

    // Validate scores are 1-5 if provided
    const scoreFields = ['technical_skill', 'communication', 'problem_solving', 'initiative', 'teamwork'];
    for (const field of scoreFields) {
      const value = body[field as keyof CreateEvaluationInput];
      if (value !== undefined && value !== null) {
        const numValue = typeof value === 'number' ? value : parseInt(String(value));
        if (numValue < 1 || numValue > 5) {
          return NextResponse.json(
            { error: `${field} must be between 1 and 5` },
            { status: 400 }
          );
        }
      }
    }

    // Check member exists
    const memberCheck = await client.query(
      'SELECT id FROM team_members WHERE id = $1',
      [id]
    );

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Member not found' },
        { status: 404 }
      );
    }

    // Upsert evaluation
    const result = await client.query<ManagerEvaluation>(`
      INSERT INTO manager_evaluations (
        member_id, evaluation_period, period_start, period_end,
        technical_skill, communication, problem_solving, initiative, teamwork,
        strengths, improvements, notes, score_adjustments, evaluated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (member_id, evaluation_period) DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        technical_skill = EXCLUDED.technical_skill,
        communication = EXCLUDED.communication,
        problem_solving = EXCLUDED.problem_solving,
        initiative = EXCLUDED.initiative,
        teamwork = EXCLUDED.teamwork,
        strengths = EXCLUDED.strengths,
        improvements = EXCLUDED.improvements,
        notes = EXCLUDED.notes,
        score_adjustments = EXCLUDED.score_adjustments,
        evaluated_by = EXCLUDED.evaluated_by,
        evaluated_at = NOW()
      RETURNING *
    `, [
      id,
      body.evaluation_period,
      body.period_start || null,
      body.period_end || null,
      body.technical_skill || null,
      body.communication || null,
      body.problem_solving || null,
      body.initiative || null,
      body.teamwork || null,
      body.strengths || null,
      body.improvements || null,
      body.notes || null,
      body.score_adjustments ? JSON.stringify(body.score_adjustments) : null,
      evaluatedBy
    ]);

    // Apply score adjustments if provided
    if (body.score_adjustments && Object.keys(body.score_adjustments).length > 0) {
      const adjustments = body.score_adjustments;
      const adjustmentUpdates: string[] = [];
      const adjustmentValues: number[] = [];
      let adjustmentIndex = 1;

      const allowedScores = ['development_score', 'review_score', 'testing_score', 'collaboration_score'];

      for (const [key, delta] of Object.entries(adjustments)) {
        if (allowedScores.includes(key) && typeof delta === 'number') {
          // Clamp to 0-100
          adjustmentUpdates.push(`${key} = LEAST(100, GREATEST(0, ${key} + $${adjustmentIndex++}))`);
          adjustmentValues.push(delta);
        }
      }

      if (adjustmentUpdates.length > 0) {
        adjustmentValues.push(id as unknown as number); // Type hack for parameterized query

        // Get current stats before adjustment
        const beforeResult = await client.query(
          'SELECT * FROM member_stats WHERE member_id = $1 AND period_type IS NULL',
          [id]
        );
        const beforeStats = beforeResult.rows[0];

        // Apply adjustments
        await client.query(`
          UPDATE member_stats
          SET ${adjustmentUpdates.join(', ')}, calculated_at = NOW()
          WHERE member_id = $${adjustmentIndex} AND period_type IS NULL
        `, adjustmentValues);

        // Get after stats
        const afterResult = await client.query(
          'SELECT * FROM member_stats WHERE member_id = $1 AND period_type IS NULL',
          [id]
        );
        const afterStats = afterResult.rows[0];

        // Record history for each adjustment
        for (const key of allowedScores) {
          if (adjustments[key] && beforeStats && afterStats) {
            await client.query(`
              INSERT INTO member_stat_history
              (member_id, trigger_type, trigger_ref, stat_name, old_value, new_value, delta, changed_by, reason)
              VALUES ($1, 'manual', $2, $3, $4, $5, $6, $7, $8)
            `, [
              id,
              `Evaluation: ${body.evaluation_period}`,
              key,
              beforeStats[key],
              afterStats[key],
              adjustments[key],
              evaluatedBy,
              'Manager evaluation score adjustment'
            ]);
          }
        }
      }
    }

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating evaluation:', error);
    return NextResponse.json(
      { error: 'Failed to create evaluation' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
