import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import SprintContent from "./SprintContent";

export const dynamic = 'force-dynamic';

interface Board {
  id: number;
  name: string;
  type: string;
  project_key: string;
}

interface Sprint {
  id: number;
  board_id: number;
  name: string;
  state: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface SprintIssue {
  key: string;
  summary: string;
  status: string;
  project: string;
  raw_data: any;
}

async function getBoards(): Promise<Board[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, name, type, project_key
      FROM jira_boards
      ORDER BY name
    `);
    return res.rows;
  } finally {
    client.release();
  }
}

async function getSprints(boardId: number): Promise<Sprint[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT id, board_id, name, state, goal, start_date, end_date
      FROM jira_sprints
      WHERE board_id = $1
      ORDER BY
        CASE state
          WHEN 'active' THEN 1
          WHEN 'future' THEN 2
          WHEN 'closed' THEN 3
        END,
        start_date DESC NULLS LAST
    `, [boardId]);
    return res.rows;
  } finally {
    client.release();
  }
}

async function getSprintIssues(sprintId: number): Promise<SprintIssue[]> {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT ji.key, ji.summary, ji.status, ji.project, ji.raw_data
      FROM jira_issue_sprints jis
      JOIN jira_issues ji ON ji.key = jis.issue_key
      WHERE jis.sprint_id = $1
      ORDER BY ji.key
    `, [sprintId]);
    return res.rows;
  } finally {
    client.release();
  }
}

interface PageProps {
  searchParams: Promise<{
    board?: string;
    sprint?: string;
    state?: string;
    assignees?: string;
    components?: string;
  }>;
}

export default async function SprintsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const boardId = params.board ? parseInt(params.board) : null;
  const sprintId = params.sprint ? parseInt(params.sprint) : null;
  const stateFilter = params.state || 'all';
  const initialAssignees = params.assignees ? params.assignees.split(',').filter(Boolean) : [];
  const initialComponents = params.components ? params.components.split(',').filter(Boolean) : [];

  // Fetch data based on URL params
  const boards = await getBoards();
  const sprints = boardId ? await getSprints(boardId) : [];
  const issues = sprintId ? await getSprintIssues(sprintId) : [];

  // Get selected sprint details
  const selectedSprint = sprints.find(s => s.id === sprintId) || null;

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Sprint Board</h1>
        </div>

        <SprintContent
          boards={boards}
          sprints={sprints}
          issues={issues}
          selectedBoardId={boardId}
          selectedSprintId={sprintId}
          selectedSprint={selectedSprint}
          stateFilter={stateFilter}
          initialAssignees={initialAssignees}
          initialComponents={initialComponents}
        />
      </div>
    </div>
  );
}
