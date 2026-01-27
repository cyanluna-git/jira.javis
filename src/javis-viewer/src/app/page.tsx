import Link from "next/link";
import pool from "@/lib/db";
import { Database, FileText, CheckSquare } from "lucide-react";

export const dynamic = 'force-dynamic';

async function getStats() {
  const jiraClient = await pool.connect();
  try {
    const jiraRes = await jiraClient.query('SELECT COUNT(*) FROM jira_issues');
    const confRes = await jiraClient.query('SELECT COUNT(*) FROM confluence_v2_content WHERE type = \'page\'');
    return {
      jiraCount: jiraRes.rows[0].count,
      confluenceCount: confRes.rows[0].count,
    };
  } catch (e) {
    console.error(e);
    return { jiraCount: 0, confluenceCount: 0 };
  } finally {
    jiraClient.release();
  }
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Javis Knowledge Base</h1>
        <p className="text-gray-600">Local mirror of Jira & Confluence data</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Jira Card */}
        <Link href="/jira" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <CheckSquare className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">Jira Issues</h2>
                <p className="text-gray-500 text-sm">Task & Bug Tracking</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.jiraCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">Synced Issues</div>
          </div>
        </Link>

        {/* Confluence Card */}
        <Link href="/confluence" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-orange-100 p-3 rounded-xl">
                <FileText className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors">Confluence</h2>
                <p className="text-gray-500 text-sm">Documentation & Specs</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.confluenceCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">Synced Pages</div>
          </div>
        </Link>
      </div>
      
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-xs font-medium text-gray-400 border border-gray-100 shadow-sm">
           <Database className="w-4 h-4" />
           Connected to PostgreSQL (javis_brain)
        </div>
      </div>
    </div>
  );
}