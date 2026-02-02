import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { isReadOnlyMode, readOnlyResponse } from '@/lib/readonly';
import type { RiskType, RiskLevel, MilestoneStatus } from '@/types/roadmap';

interface MilestoneData {
  id: string;
  title: string;
  vision_title: string;
  progress_percent: number;
  status: MilestoneStatus;
  risk_level: RiskLevel;
  target_start: string | null;
  target_end: string | null;
  quarter: string | null;
  depends_on: string[] | null;
}

interface EpicStats {
  milestone_id: string;
  epic_key: string;
  total_issues: number;
  done_issues: number;
  blocked_issues: number;
  in_progress_issues: number;
}

interface DetectedRisk {
  milestone_id: string;
  stream_id?: string;
  epic_key?: string;
  risk_type: RiskType;
  severity: RiskLevel;
  title: string;
  description: string;
  ai_suggestion: string;
  confidence_score: number;
  trigger_data: Record<string, unknown>;
}

// Risk Detection Logic
function analyzeRisks(
  milestones: MilestoneData[],
  epicStats: EpicStats[]
): DetectedRisk[] {
  const risks: DetectedRisk[] = [];
  const today = new Date();

  for (const milestone of milestones) {
    // 1. Delay Risk - Target end date passed but not completed
    if (milestone.target_end && milestone.status !== 'completed') {
      const targetEnd = new Date(milestone.target_end);
      const daysOverdue = Math.floor((today.getTime() - targetEnd.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue > 0) {
        const severity: RiskLevel = daysOverdue > 14 ? 'critical' : daysOverdue > 7 ? 'high' : 'medium';
        risks.push({
          milestone_id: milestone.id,
          risk_type: 'delay',
          severity,
          title: `일정 지연: ${milestone.title}`,
          description: `목표 완료일(${milestone.target_end})을 ${daysOverdue}일 초과했습니다.`,
          ai_suggestion: daysOverdue > 14
            ? '일정 재조정 또는 범위 축소를 권장합니다. 이해관계자와 지연 사유를 공유하세요.'
            : '진행 속도 점검이 필요합니다. 차단 요소가 있는지 확인하세요.',
          confidence_score: 0.95,
          trigger_data: {
            target_end: milestone.target_end,
            days_overdue: daysOverdue,
            current_progress: milestone.progress_percent,
          },
        });
      }
    }

    // 2. Slow Progress Risk - Started but progress is too slow
    if (milestone.target_start && milestone.target_end && milestone.status === 'in_progress') {
      const targetStart = new Date(milestone.target_start);
      const targetEnd = new Date(milestone.target_end);
      const totalDuration = targetEnd.getTime() - targetStart.getTime();
      const elapsed = today.getTime() - targetStart.getTime();
      const timeProgress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
      const progressGap = timeProgress - milestone.progress_percent;

      if (progressGap > 20) {
        const severity: RiskLevel = progressGap > 40 ? 'high' : 'medium';
        risks.push({
          milestone_id: milestone.id,
          risk_type: 'velocity_drop',
          severity,
          title: `진행 속도 저하: ${milestone.title}`,
          description: `시간 진행률(${Math.round(timeProgress)}%) 대비 실제 진행률(${Math.round(milestone.progress_percent)}%)이 ${Math.round(progressGap)}% 뒤처져 있습니다.`,
          ai_suggestion: '리소스 재배치 또는 작업 우선순위 조정을 검토하세요. 차단 요소가 있는지 확인이 필요합니다.',
          confidence_score: 0.85,
          trigger_data: {
            time_progress: Math.round(timeProgress),
            actual_progress: milestone.progress_percent,
            progress_gap: Math.round(progressGap),
          },
        });
      }
    }

    // 3. Blocker Risk - Milestone is blocked status
    if (milestone.status === 'blocked') {
      risks.push({
        milestone_id: milestone.id,
        risk_type: 'blocker',
        severity: 'critical',
        title: `차단됨: ${milestone.title}`,
        description: '마일스톤이 차단 상태입니다. 즉각적인 조치가 필요합니다.',
        ai_suggestion: '차단 원인을 파악하고 해결 방안을 마련하세요. 의존성 또는 외부 요인을 점검하세요.',
        confidence_score: 1.0,
        trigger_data: {
          status: milestone.status,
        },
      });
    }

    // 4. Dependency Block Risk - Dependencies not completed
    if (milestone.depends_on && milestone.depends_on.length > 0) {
      const depMilestones = milestones.filter(m => milestone.depends_on?.includes(m.id));
      const blockedDeps = depMilestones.filter(m => m.status !== 'completed');

      if (blockedDeps.length > 0 && milestone.status === 'in_progress') {
        risks.push({
          milestone_id: milestone.id,
          risk_type: 'dependency_block',
          severity: 'high',
          title: `의존성 미완료: ${milestone.title}`,
          description: `선행 마일스톤 ${blockedDeps.length}개가 아직 완료되지 않았습니다.`,
          ai_suggestion: '선행 마일스톤 완료 가속화 또는 병렬 진행 가능 여부를 검토하세요.',
          confidence_score: 0.90,
          trigger_data: {
            blocked_dependencies: blockedDeps.map(d => ({ id: d.id, title: d.title, status: d.status })),
          },
        });
      }
    }
  }

  // 5. Epic-level risks - Blocked issues in Epic
  const epicStatsMap = new Map<string, EpicStats[]>();
  epicStats.forEach(stat => {
    const existing = epicStatsMap.get(stat.milestone_id) || [];
    existing.push(stat);
    epicStatsMap.set(stat.milestone_id, existing);
  });

  for (const [milestoneId, stats] of epicStatsMap) {
    const milestone = milestones.find(m => m.id === milestoneId);
    if (!milestone) continue;

    for (const stat of stats) {
      // Blocker issues in Epic
      if (stat.blocked_issues > 0) {
        const blockRatio = stat.blocked_issues / stat.total_issues;
        const severity: RiskLevel = blockRatio > 0.3 ? 'critical' : blockRatio > 0.1 ? 'high' : 'medium';

        risks.push({
          milestone_id: milestoneId,
          epic_key: stat.epic_key,
          risk_type: 'blocker',
          severity,
          title: `Epic 차단 이슈: ${stat.epic_key}`,
          description: `${stat.epic_key}에 차단된 이슈가 ${stat.blocked_issues}개 있습니다 (전체 ${stat.total_issues}개 중).`,
          ai_suggestion: '차단된 이슈를 우선 해결하세요. 차단 원인 분석 및 에스컬레이션을 검토하세요.',
          confidence_score: 0.88,
          trigger_data: {
            epic_key: stat.epic_key,
            total_issues: stat.total_issues,
            blocked_issues: stat.blocked_issues,
            block_ratio: Math.round(blockRatio * 100),
          },
        });
      }

      // Stalled Epic - High in-progress but low completion
      if (stat.total_issues >= 5 && stat.in_progress_issues > stat.done_issues * 2) {
        risks.push({
          milestone_id: milestoneId,
          epic_key: stat.epic_key,
          risk_type: 'velocity_drop',
          severity: 'medium',
          title: `Epic 진행 정체: ${stat.epic_key}`,
          description: `진행 중(${stat.in_progress_issues})이 완료(${stat.done_issues})보다 많습니다. 작업이 정체될 수 있습니다.`,
          ai_suggestion: 'WIP 제한 적용을 권장합니다. 진행 중인 작업을 먼저 완료하세요.',
          confidence_score: 0.75,
          trigger_data: {
            epic_key: stat.epic_key,
            in_progress: stat.in_progress_issues,
            done: stat.done_issues,
            total: stat.total_issues,
          },
        });
      }
    }
  }

  return risks;
}

// GET /api/roadmap/risks - List detected risks
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const milestoneId = searchParams.get('milestone_id');
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');
  const limit = parseInt(searchParams.get('limit') || '50');

  const client = await pool.connect();

  try {
    const conditions: string[] = [];
    const values: (string | number)[] = [];
    let paramIndex = 1;

    if (milestoneId) {
      conditions.push(`r.milestone_id = $${paramIndex++}`);
      values.push(milestoneId);
    }

    if (status) {
      conditions.push(`r.status = $${paramIndex++}`);
      values.push(status);
    }

    if (severity) {
      conditions.push(`r.severity = $${paramIndex++}`);
      values.push(severity);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        r.*,
        m.title as milestone_title,
        v.title as vision_title,
        s.name as stream_name
      FROM roadmap_risks r
      LEFT JOIN roadmap_milestones m ON r.milestone_id = m.id
      LEFT JOIN roadmap_visions v ON m.vision_id = v.id
      LEFT JOIN roadmap_streams s ON r.stream_id = s.id
      ${whereClause}
      ORDER BY
        CASE r.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        r.detected_at DESC
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    const result = await client.query(query, values);

    // Also get summary
    const summaryQuery = `
      SELECT
        COUNT(*) as total_risks,
        COUNT(*) FILTER (WHERE status = 'open') as open_risks,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE severity = 'high') as high,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium,
        COUNT(*) FILTER (WHERE severity = 'low') as low
      FROM roadmap_risks
      ${milestoneId ? 'WHERE milestone_id = $1' : ''}
    `;

    const summaryResult = await client.query(
      summaryQuery,
      milestoneId ? [milestoneId] : []
    );

    const summary = summaryResult.rows[0];

    return NextResponse.json({
      risks: result.rows,
      summary: {
        total_risks: parseInt(summary.total_risks),
        open_risks: parseInt(summary.open_risks),
        by_severity: {
          critical: parseInt(summary.critical),
          high: parseInt(summary.high),
          medium: parseInt(summary.medium),
          low: parseInt(summary.low),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching risks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch risks' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// POST /api/roadmap/risks - Run risk analysis
export async function POST(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const body = await request.json();
  const visionId = body.vision_id;

  const client = await pool.connect();

  try {
    // Fetch milestones
    let milestoneQuery = `
      SELECT
        m.id,
        m.title,
        v.title as vision_title,
        m.progress_percent,
        m.status,
        m.risk_level,
        m.target_start,
        m.target_end,
        m.quarter,
        m.depends_on
      FROM roadmap_milestones m
      JOIN roadmap_visions v ON m.vision_id = v.id
      WHERE m.status != 'completed'
    `;

    const milestoneValues: string[] = [];
    if (visionId) {
      milestoneQuery += ' AND m.vision_id = $1';
      milestoneValues.push(visionId);
    }

    const milestonesResult = await client.query<MilestoneData>(milestoneQuery, milestoneValues);
    const milestones = milestonesResult.rows;

    // Fetch Epic statistics
    const milestoneIds = milestones.map(m => m.id);
    let epicStats: EpicStats[] = [];

    if (milestoneIds.length > 0) {
      const epicLinksResult = await client.query<{ milestone_id: string; epic_key: string }>(
        `SELECT milestone_id, epic_key FROM roadmap_epic_links WHERE milestone_id = ANY($1)`,
        [milestoneIds]
      );

      const epicKeys = epicLinksResult.rows.map(r => r.epic_key);

      if (epicKeys.length > 0) {
        // Get issue stats for each epic
        const issueStatsResult = await client.query(`
          SELECT
            raw_data->'fields'->'parent'->>'key' as epic_key,
            COUNT(*) as total_issues,
            COUNT(*) FILTER (WHERE raw_data->'fields'->'status'->>'name' IN ('Done', 'Closed', 'Resolved', 'Complete', 'Completed')) as done_issues,
            COUNT(*) FILTER (WHERE raw_data->'fields'->'status'->>'name' IN ('Blocked', 'On Hold')) as blocked_issues,
            COUNT(*) FILTER (WHERE raw_data->'fields'->'status'->>'name' IN ('In Progress', 'In Review', 'Testing')) as in_progress_issues
          FROM jira_issues
          WHERE raw_data->'fields'->'parent'->>'key' = ANY($1)
          GROUP BY raw_data->'fields'->'parent'->>'key'
        `, [epicKeys]);

        // Map epic stats to milestone
        const epicToMilestone = new Map<string, string>();
        epicLinksResult.rows.forEach(r => epicToMilestone.set(r.epic_key, r.milestone_id));

        epicStats = issueStatsResult.rows.map(row => ({
          milestone_id: epicToMilestone.get(row.epic_key) || '',
          epic_key: row.epic_key,
          total_issues: parseInt(row.total_issues),
          done_issues: parseInt(row.done_issues),
          blocked_issues: parseInt(row.blocked_issues),
          in_progress_issues: parseInt(row.in_progress_issues),
        })).filter(s => s.milestone_id);
      }
    }

    // Run analysis
    const detectedRisks = analyzeRisks(milestones, epicStats);

    // Insert new risks (avoid duplicates by checking existing open risks)
    let insertedCount = 0;
    let updatedCount = 0;

    for (const risk of detectedRisks) {
      // Check for existing similar open risk
      const existingResult = await client.query(`
        SELECT id FROM roadmap_risks
        WHERE milestone_id = $1
          AND risk_type = $2
          AND (epic_key = $3 OR (epic_key IS NULL AND $3 IS NULL))
          AND status = 'open'
      `, [risk.milestone_id, risk.risk_type, risk.epic_key || null]);

      if (existingResult.rows.length > 0) {
        // Update existing risk
        await client.query(`
          UPDATE roadmap_risks SET
            severity = $2,
            title = $3,
            description = $4,
            ai_suggestion = $5,
            confidence_score = $6,
            trigger_data = $7,
            detected_at = NOW()
          WHERE id = $1
        `, [
          existingResult.rows[0].id,
          risk.severity,
          risk.title,
          risk.description,
          risk.ai_suggestion,
          risk.confidence_score,
          risk.trigger_data,
        ]);
        updatedCount++;
      } else {
        // Insert new risk
        await client.query(`
          INSERT INTO roadmap_risks (
            milestone_id, stream_id, epic_key, risk_type, severity,
            title, description, ai_suggestion, confidence_score, trigger_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          risk.milestone_id,
          risk.stream_id || null,
          risk.epic_key || null,
          risk.risk_type,
          risk.severity,
          risk.title,
          risk.description,
          risk.ai_suggestion,
          risk.confidence_score,
          risk.trigger_data,
        ]);
        insertedCount++;
      }
    }

    // Auto-resolve risks that are no longer detected
    const activeRiskKeys = detectedRisks.map(r =>
      `${r.milestone_id}:${r.risk_type}:${r.epic_key || ''}`
    );

    const openRisksResult = await client.query(`
      SELECT id, milestone_id, risk_type, epic_key
      FROM roadmap_risks
      WHERE status = 'open'
        ${visionId ? 'AND milestone_id IN (SELECT id FROM roadmap_milestones WHERE vision_id = $1)' : ''}
    `, visionId ? [visionId] : []);

    let resolvedCount = 0;
    for (const row of openRisksResult.rows) {
      const key = `${row.milestone_id}:${row.risk_type}:${row.epic_key || ''}`;
      if (!activeRiskKeys.includes(key)) {
        await client.query(`
          UPDATE roadmap_risks SET
            status = 'resolved',
            resolved_at = NOW(),
            resolution_note = '자동 해결: 조건이 더 이상 감지되지 않음'
          WHERE id = $1
        `, [row.id]);
        resolvedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      analyzed_milestones: milestones.length,
      analyzed_epics: epicStats.length,
      detected_risks: detectedRisks.length,
      inserted: insertedCount,
      updated: updatedCount,
      auto_resolved: resolvedCount,
    });
  } catch (error) {
    console.error('Error analyzing risks:', error);
    return NextResponse.json(
      { error: 'Failed to analyze risks' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

// PATCH /api/roadmap/risks - Update risk status
export async function PATCH(request: NextRequest) {
  if (isReadOnlyMode()) return readOnlyResponse();

  const body = await request.json();
  const { id, status, resolution_note } = body;

  if (!id || !status) {
    return NextResponse.json(
      { error: 'id and status are required' },
      { status: 400 }
    );
  }

  const client = await pool.connect();

  try {
    const resolvedAt = ['resolved', 'mitigated', 'false_positive'].includes(status)
      ? 'NOW()'
      : 'NULL';

    await client.query(`
      UPDATE roadmap_risks SET
        status = $2,
        resolution_note = COALESCE($3, resolution_note),
        resolved_at = ${resolvedAt}
      WHERE id = $1
    `, [id, status, resolution_note || null]);

    // Log to history
    await client.query(`
      INSERT INTO roadmap_risk_history (risk_id, action, new_status, note)
      VALUES ($1, 'status_changed', $2, $3)
    `, [id, status, resolution_note || null]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating risk:', error);
    return NextResponse.json(
      { error: 'Failed to update risk' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
