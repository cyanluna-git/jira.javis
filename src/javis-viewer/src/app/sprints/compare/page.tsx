import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft, Home } from "lucide-react";
import CompareContent from "./CompareContent";

export const dynamic = 'force-dynamic';

interface Sprint {
  id: number;
  name: string;
  state: string;
  startDate: string | null;
  endDate: string | null;
  boardId: number;
  boardName: string;
}

interface SprintStats {
  sprintId: number;
  sprintName: string;
  totalIssues: number;
  completedIssues: number;
  totalPoints: number;
  completedPoints: number;
  completionRate: number;
  pointCompletionRate: number;
}

interface AssigneeStats {
  name: string;
  sprint1Issues: number;
  sprint1Points: number;
  sprint2Issues: number;
  sprint2Points: number;
}

interface ComponentStats {
  name: string;
  sprint1Total: number;
  sprint1Done: number;
  sprint2Total: number;
  sprint2Done: number;
}

async function getSprints(): Promise<Sprint[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        s.id, s.name, s.state, s.start_date, s.end_date,
        b.id as board_id, b.name as board_name
      FROM jira_sprints s
      JOIN jira_boards b ON s.board_id = b.id
      WHERE s.state IN ('active', 'closed')
      ORDER BY s.end_date DESC NULLS LAST
    `);
    return res.rows.map(row => ({
      id: row.id,
      name: row.name,
      state: row.state,
      startDate: row.start_date,
      endDate: row.end_date,
      boardId: row.board_id,
      boardName: row.board_name,
    }));
  } finally {
    client.release();
  }
}

async function getSprintStats(sprintId: number): Promise<SprintStats | null> {
  const client = await pool.connect();
  try {
    // Use LEFT JOIN to handle empty sprints (sprints with no issues)
    const res = await client.query(`
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        COUNT(ji.key) as total_issues,
        COUNT(CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN 1 END) as completed_issues,
        COALESCE(SUM(
          COALESCE(
            (ji.raw_data->'fields'->>'customfield_10016')::numeric,
            0
          )
        ), 0) as total_points,
        COALESCE(SUM(
          CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN
            COALESCE(
              (ji.raw_data->'fields'->>'customfield_10016')::numeric,
              0
            )
          ELSE 0 END
        ), 0) as completed_points
      FROM jira_sprints s
      LEFT JOIN jira_issue_sprints jis ON s.id = jis.sprint_id
      LEFT JOIN jira_issues ji ON jis.issue_key = ji.key
      WHERE s.id = $1
      GROUP BY s.id, s.name
    `, [sprintId]);

    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const totalIssues = parseInt(row.total_issues);
    const completedIssues = parseInt(row.completed_issues);
    const totalPoints = parseFloat(row.total_points) || 0;
    const completedPoints = parseFloat(row.completed_points) || 0;

    return {
      sprintId: row.sprint_id,
      sprintName: row.sprint_name,
      totalIssues,
      completedIssues,
      totalPoints,
      completedPoints,
      completionRate: totalIssues > 0 ? Math.round((completedIssues / totalIssues) * 100) : 0,
      pointCompletionRate: totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0,
    };
  } finally {
    client.release();
  }
}

async function getAssigneeComparison(sprint1Id: number, sprint2Id: number): Promise<AssigneeStats[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      WITH sprint_data AS (
        SELECT
          jis.sprint_id,
          COALESCE(ji.raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as assignee_name,
          COUNT(ji.key) as issue_count,
          COALESCE(SUM(
            COALESCE((ji.raw_data->'fields'->>'customfield_10016')::numeric, 0)
          ), 0) as points
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON jis.issue_key = ji.key
        WHERE jis.sprint_id IN ($1, $2)
          AND LOWER(ji.status) IN ('done', 'closed', 'resolved')
        GROUP BY jis.sprint_id, assignee_name
      )
      SELECT
        COALESCE(s1.assignee_name, s2.assignee_name) as name,
        COALESCE(s1.issue_count, 0) as sprint1_issues,
        COALESCE(s1.points, 0) as sprint1_points,
        COALESCE(s2.issue_count, 0) as sprint2_issues,
        COALESCE(s2.points, 0) as sprint2_points
      FROM (SELECT * FROM sprint_data WHERE sprint_id = $1) s1
      FULL OUTER JOIN (SELECT * FROM sprint_data WHERE sprint_id = $2) s2
        ON s1.assignee_name = s2.assignee_name
      ORDER BY (COALESCE(s1.points, 0) + COALESCE(s2.points, 0)) DESC
      LIMIT 10
    `, [sprint1Id, sprint2Id]);

    return res.rows.map(row => ({
      name: row.name,
      sprint1Issues: parseInt(row.sprint1_issues),
      sprint1Points: parseFloat(row.sprint1_points) || 0,
      sprint2Issues: parseInt(row.sprint2_issues),
      sprint2Points: parseFloat(row.sprint2_points) || 0,
    }));
  } finally {
    client.release();
  }
}

async function getComponentComparison(sprint1Id: number, sprint2Id: number): Promise<ComponentStats[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      WITH sprint_data AS (
        SELECT
          jis.sprint_id,
          comp->>'name' as component_name,
          COUNT(*) as total,
          COUNT(CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN 1 END) as done
        FROM jira_issue_sprints jis
        JOIN jira_issues ji ON jis.issue_key = ji.key,
        jsonb_array_elements(ji.raw_data->'fields'->'components') as comp
        WHERE jis.sprint_id IN ($1, $2)
        GROUP BY jis.sprint_id, component_name
      )
      SELECT
        COALESCE(s1.component_name, s2.component_name) as name,
        COALESCE(s1.total, 0) as sprint1_total,
        COALESCE(s1.done, 0) as sprint1_done,
        COALESCE(s2.total, 0) as sprint2_total,
        COALESCE(s2.done, 0) as sprint2_done
      FROM (SELECT * FROM sprint_data WHERE sprint_id = $1) s1
      FULL OUTER JOIN (SELECT * FROM sprint_data WHERE sprint_id = $2) s2
        ON s1.component_name = s2.component_name
      ORDER BY (COALESCE(s1.total, 0) + COALESCE(s2.total, 0)) DESC
      LIMIT 10
    `, [sprint1Id, sprint2Id]);

    return res.rows.map(row => ({
      name: row.name,
      sprint1Total: parseInt(row.sprint1_total),
      sprint1Done: parseInt(row.sprint1_done),
      sprint2Total: parseInt(row.sprint2_total),
      sprint2Done: parseInt(row.sprint2_done),
    }));
  } finally {
    client.release();
  }
}

interface Props {
  searchParams: Promise<{ sprint1?: string; sprint2?: string }>;
}

export default async function ComparePage({ searchParams }: Props) {
  const params = await searchParams;
  const parsedSprint1 = params.sprint1 ? parseInt(params.sprint1) : NaN;
  const parsedSprint2 = params.sprint2 ? parseInt(params.sprint2) : NaN;
  const sprint1Id = !isNaN(parsedSprint1) ? parsedSprint1 : null;
  const sprint2Id = !isNaN(parsedSprint2) ? parsedSprint2 : null;

  try {
    const sprints = await getSprints();

    let sprint1Stats: SprintStats | null = null;
    let sprint2Stats: SprintStats | null = null;
    let assigneeComparison: AssigneeStats[] = [];
    let componentComparison: ComponentStats[] = [];

    if (sprint1Id && sprint2Id) {
      [sprint1Stats, sprint2Stats, assigneeComparison, componentComparison] = await Promise.all([
        getSprintStats(sprint1Id),
        getSprintStats(sprint2Id),
        getAssigneeComparison(sprint1Id, sprint2Id),
        getComponentComparison(sprint1Id, sprint2Id),
      ]);
    }

    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Link href="/sprints" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Sprint Compare</h1>
          </div>

          <CompareContent
            sprints={sprints}
            selectedSprint1={sprint1Id}
            selectedSprint2={sprint2Id}
            sprint1Stats={sprint1Stats}
            sprint2Stats={sprint2Stats}
            assigneeComparison={assigneeComparison}
            componentComparison={componentComparison}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Compare page error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Link href="/sprints" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </Link>
              <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <Home className="w-5 h-5 text-gray-600" />
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Sprint Compare</h1>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 font-medium">Failed to load comparison data</p>
            <p className="text-gray-500 text-sm mt-2">Please check your database connection and try again.</p>
          </div>
        </div>
      </div>
    );
  }
}
