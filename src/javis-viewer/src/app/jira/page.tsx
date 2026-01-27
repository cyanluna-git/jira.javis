import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getIssues() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT key, summary, status, project, created_at 
      FROM jira_issues 
      ORDER BY created_at DESC 
      LIMIT 100
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
        <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
                <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </Link>
                <h1 className="text-3xl font-bold text-gray-900">Jira Issues</h1>
            </div>
            <div className="text-sm text-gray-500">Showing recent 100 issues</div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-700 w-32">Key</th>
                <th className="px-6 py-4 font-semibold text-gray-700">Summary</th>
                <th className="px-6 py-4 font-semibold text-gray-700 w-32">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-700 w-24">Project</th>
                <th className="px-6 py-4 font-semibold text-gray-700 w-40">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {issues.map((issue) => (
                <tr key={issue.key} className="hover:bg-blue-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-blue-600">
                    {issue.key}
                  </td>
                  <td className="px-6 py-4 text-gray-800 font-medium">
                    {issue.summary}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{issue.project}</td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
