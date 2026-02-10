import pool from "@/lib/db";
import JiraContent from "./JiraContent";
import { NavigationButtons } from "@/components/NavigationButtons";

export const dynamic = 'force-dynamic';

async function getIssues() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT key, summary, status, project, created_at, raw_data
      FROM jira_issues
      ORDER BY created_at DESC
    `);
    return res.rows;
  } finally {
    client.release();
  }
}

export default async function JiraPage() {
  const issues = await getIssues();

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="mx-auto px-4">
        <div className="mb-8 flex items-center gap-4">
            <NavigationButtons />
            <h1 className="text-3xl font-bold text-gray-900">Jira Issues</h1>
        </div>

        <JiraContent issues={issues} />
      </div>
    </div>
  );
}
