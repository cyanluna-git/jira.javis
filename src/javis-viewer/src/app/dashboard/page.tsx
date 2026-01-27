import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import DashboardContent from "./DashboardContent";

export const dynamic = 'force-dynamic';

interface DashboardStats {
  totalIssues: number;
  openIssues: number;
  closedIssues: number;
  activeSprints: number;
  totalBoards: number;
  completionRate: number;
}

interface SprintVelocity {
  sprintName: string;
  sprintId: number;
  totalPoints: number;
  completedPoints: number;
  issueCount: number;
  completedCount: number;
}

interface AssigneeWorkload {
  name: string;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
}

interface StatusDistribution {
  status: string;
  count: number;
}

interface RecentIssue {
  key: string;
  summary: string;
  status: string;
  assignee: string | null;
  updated: string;
}

interface ComponentHealth {
  name: string;
  total: number;
  done: number;
  percentage: number;
}

async function getDashboardStats(): Promise<DashboardStats> {
  const client = await pool.connect();
  try {
    const [totalRes, openRes, closedRes, sprintRes, boardRes] = await Promise.all([
      client.query('SELECT COUNT(*) FROM jira_issues'),
      client.query("SELECT COUNT(*) FROM jira_issues WHERE LOWER(status) NOT IN ('done', 'closed', 'resolved')"),
      client.query("SELECT COUNT(*) FROM jira_issues WHERE LOWER(status) IN ('done', 'closed', 'resolved')"),
      client.query("SELECT COUNT(*) FROM jira_sprints WHERE state = 'active'"),
      client.query('SELECT COUNT(*) FROM jira_boards'),
    ]);

    const total = parseInt(totalRes.rows[0].count);
    const closed = parseInt(closedRes.rows[0].count);

    return {
      totalIssues: total,
      openIssues: parseInt(openRes.rows[0].count),
      closedIssues: closed,
      activeSprints: parseInt(sprintRes.rows[0].count),
      totalBoards: parseInt(boardRes.rows[0].count),
      completionRate: total > 0 ? Math.round((closed / total) * 100) : 0,
    };
  } finally {
    client.release();
  }
}

async function getSprintVelocity(): Promise<SprintVelocity[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        s.id as sprint_id,
        s.name as sprint_name,
        COUNT(ji.key) as issue_count,
        COUNT(CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN 1 END) as completed_count,
        COALESCE(SUM(
          COALESCE(
            (ji.raw_data->'fields'->>'customfield_10016')::numeric,
            (ji.raw_data->'fields'->>'storyPoints')::numeric,
            0
          )
        ), 0) as total_points,
        COALESCE(SUM(
          CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN
            COALESCE(
              (ji.raw_data->'fields'->>'customfield_10016')::numeric,
              (ji.raw_data->'fields'->>'storyPoints')::numeric,
              0
            )
          ELSE 0 END
        ), 0) as completed_points
      FROM jira_sprints s
      JOIN jira_issue_sprints jis ON s.id = jis.sprint_id
      JOIN jira_issues ji ON jis.issue_key = ji.key
      WHERE s.state IN ('active', 'closed')
      GROUP BY s.id, s.name, s.end_date
      ORDER BY s.end_date DESC NULLS LAST
      LIMIT 8
    `);

    return res.rows.map(row => ({
      sprintId: row.sprint_id,
      sprintName: row.sprint_name,
      totalPoints: parseFloat(row.total_points) || 0,
      completedPoints: parseFloat(row.completed_points) || 0,
      issueCount: parseInt(row.issue_count),
      completedCount: parseInt(row.completed_count),
    })).reverse();
  } finally {
    client.release();
  }
}

async function getAssigneeWorkload(): Promise<AssigneeWorkload[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        COALESCE(raw_data->'fields'->'assignee'->>'displayName', 'Unassigned') as assignee_name,
        COUNT(*) as total,
        COUNT(CASE WHEN LOWER(status) IN ('done', 'closed', 'resolved') THEN 1 END) as done,
        COUNT(CASE WHEN LOWER(status) IN ('in progress', 'in review', 'testing') THEN 1 END) as in_progress,
        COUNT(CASE WHEN LOWER(status) NOT IN ('done', 'closed', 'resolved', 'in progress', 'in review', 'testing') THEN 1 END) as todo
      FROM jira_issues
      GROUP BY assignee_name
      ORDER BY total DESC
      LIMIT 10
    `);

    return res.rows.map(row => ({
      name: row.assignee_name,
      total: parseInt(row.total),
      done: parseInt(row.done),
      inProgress: parseInt(row.in_progress),
      todo: parseInt(row.todo),
    }));
  } finally {
    client.release();
  }
}

async function getStatusDistribution(): Promise<StatusDistribution[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT status, COUNT(*) as count
      FROM jira_issues
      GROUP BY status
      ORDER BY count DESC
    `);

    return res.rows.map(row => ({
      status: row.status,
      count: parseInt(row.count),
    }));
  } finally {
    client.release();
  }
}

async function getRecentIssues(): Promise<RecentIssue[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        key,
        summary,
        status,
        raw_data->'fields'->'assignee'->>'displayName' as assignee,
        raw_data->'fields'->>'updated' as updated
      FROM jira_issues
      ORDER BY (raw_data->'fields'->>'updated')::timestamp DESC
      LIMIT 10
    `);

    return res.rows.map(row => ({
      key: row.key,
      summary: row.summary,
      status: row.status,
      assignee: row.assignee,
      updated: row.updated,
    }));
  } finally {
    client.release();
  }
}

async function getComponentHealth(): Promise<ComponentHealth[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT
        comp->>'name' as component_name,
        COUNT(*) as total,
        COUNT(CASE WHEN LOWER(ji.status) IN ('done', 'closed', 'resolved') THEN 1 END) as done
      FROM jira_issues ji,
           jsonb_array_elements(ji.raw_data->'fields'->'components') as comp
      GROUP BY component_name
      ORDER BY total DESC
      LIMIT 8
    `);

    return res.rows.map(row => {
      const total = parseInt(row.total);
      const done = parseInt(row.done);
      return {
        name: row.component_name,
        total,
        done,
        percentage: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
  } finally {
    client.release();
  }
}

export default async function DashboardPage() {
  try {
    const [stats, velocity, workload, statusDist, recentIssues, componentHealth] = await Promise.all([
      getDashboardStats(),
      getSprintVelocity(),
      getAssigneeWorkload(),
      getStatusDistribution(),
      getRecentIssues(),
      getComponentHealth(),
    ]);

    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          </div>

          <DashboardContent
            stats={stats}
            velocity={velocity}
            workload={workload}
            statusDistribution={statusDist}
            recentIssues={recentIssues}
            componentHealth={componentHealth}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 font-medium">Failed to load dashboard data</p>
            <p className="text-gray-500 text-sm mt-2">Please check your database connection and try again.</p>
          </div>
        </div>
      </div>
    );
  }
}
