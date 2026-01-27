import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import JiraContent from "./JiraContent";

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
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Jira Issues</h1>
        </div>

        <JiraContent issues={issues} />
      </div>
    </div>
  );
}
