import Link from "next/link";
import pool from "@/lib/db";
import { Database, FileText, CheckSquare, LayoutGrid, BarChart3, Search, Layers, Map, Headphones, Users, Package } from "lucide-react";
import { getServiceDeskStats } from "@/lib/service-desk";

export const dynamic = 'force-dynamic';

async function getStats() {
  const client = await pool.connect();
  try {
    const jiraRes = await client.query('SELECT COUNT(*) FROM jira_issues');
    const confRes = await client.query('SELECT COUNT(*) FROM confluence_v2_content WHERE type = \'page\'');
    const sprintRes = await client.query('SELECT COUNT(*) FROM jira_sprints');
    const boardRes = await client.query('SELECT COUNT(*) FROM jira_boards');

    // Try to get operations count (table may not exist yet)
    let opsCount = 0;
    let pendingOpsCount = 0;
    try {
      const opsRes = await client.query('SELECT COUNT(*) FROM content_operations');
      const pendingRes = await client.query("SELECT COUNT(*) FROM content_operations WHERE status = 'pending'");
      opsCount = opsRes.rows[0].count;
      pendingOpsCount = pendingRes.rows[0].count;
    } catch {
      // Table doesn't exist yet
    }

    // Try to get roadmap stats
    let visionCount = 0;
    let milestoneCount = 0;
    let inProgressMilestones = 0;
    try {
      const visionRes = await client.query("SELECT COUNT(*) FROM roadmap_visions WHERE status = 'active'");
      const milestoneRes = await client.query('SELECT COUNT(*) FROM roadmap_milestones');
      const inProgressRes = await client.query("SELECT COUNT(*) FROM roadmap_milestones WHERE status = 'in_progress'");
      visionCount = visionRes.rows[0].count;
      milestoneCount = milestoneRes.rows[0].count;
      inProgressMilestones = inProgressRes.rows[0].count;
    } catch {
      // Table doesn't exist yet
    }

    // Get PSSM service desk stats using shared function
    let serviceDeskTotal = 0;
    let serviceDeskOpen = 0;
    try {
      const sdStats = await getServiceDeskStats();
      serviceDeskTotal = sdStats.total;
      serviceDeskOpen = sdStats.open;
    } catch {
      // Query failed
    }

    // Get team members stats
    let memberCount = 0;
    let activeMemberCount = 0;
    try {
      const memberRes = await client.query('SELECT COUNT(*) FROM team_members');
      const activeRes = await client.query("SELECT COUNT(*) FROM team_members WHERE is_active = true");
      memberCount = parseInt(memberRes.rows[0].count);
      activeMemberCount = parseInt(activeRes.rows[0].count);
    } catch {
      // Table doesn't exist yet
    }

    // Get bundle stats (EUV project Epics with "Bundle" in summary)
    let bundleCount = 0;
    let activeBundleCount = 0;
    try {
      const bundleRes = await client.query(`
        SELECT COUNT(*) FROM jira_issues
        WHERE project = 'EUV'
          AND raw_data->'fields'->'issuetype'->>'name' = 'Epic'
          AND summary LIKE 'Bundle %'
      `);
      const activeRes = await client.query(`
        SELECT COUNT(*) FROM jira_issues
        WHERE project = 'EUV'
          AND raw_data->'fields'->'issuetype'->>'name' = 'Epic'
          AND summary LIKE 'Bundle %'
          AND status NOT IN ('Done', 'Closed')
      `);
      bundleCount = parseInt(bundleRes.rows[0].count);
      activeBundleCount = parseInt(activeRes.rows[0].count);
    } catch {
      // Query failed
    }

    return {
      jiraCount: jiraRes.rows[0].count,
      confluenceCount: confRes.rows[0].count,
      sprintCount: sprintRes.rows[0].count,
      boardCount: boardRes.rows[0].count,
      opsCount,
      pendingOpsCount,
      visionCount,
      milestoneCount,
      inProgressMilestones,
      serviceDeskTotal,
      serviceDeskOpen,
      memberCount,
      activeMemberCount,
      bundleCount,
      activeBundleCount,
    };
  } catch (e) {
    console.error(e);
    return { jiraCount: 0, confluenceCount: 0, sprintCount: 0, boardCount: 0, opsCount: 0, pendingOpsCount: 0, visionCount: 0, milestoneCount: 0, inProgressMilestones: 0, serviceDeskTotal: 0, serviceDeskOpen: 0, memberCount: 0, activeMemberCount: 0, bundleCount: 0, activeBundleCount: 0 };
  } finally {
    client.release();
  }
}

export default async function Home() {
  const stats = await getStats();
  const isReadOnly = process.env.NEXT_PUBLIC_READ_ONLY?.toLowerCase() === 'true';

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold text-gray-900">Jarvis</h1>
      </header>

      {/* Search Bar */}
      <div className="max-w-2xl mx-auto mb-10">
        <Link href="/search" className="block">
          <div className="flex items-center gap-3 bg-white px-5 py-4 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer">
            <Search className="w-5 h-5 text-gray-400" />
            <span className="text-gray-400">Search Jira issues and Confluence pages...</span>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {/* Dashboard Card */}
        <Link href="/dashboard" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-purple-100 p-3 rounded-xl">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-purple-600 transition-colors">Dashboard</h2>
                <p className="text-gray-500 text-sm">Project Overview</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              Overview
            </div>
            <div className="text-gray-400 text-sm font-medium">Charts & Stats</div>
          </div>
        </Link>

        {/* Jira Card */}
        <Link href="/jira" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <CheckSquare className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-blue-600 transition-colors">Jira Issues</h2>
                <p className="text-gray-500 text-sm">Task & Bug Tracking</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.jiraCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">Synced Issues</div>
          </div>
        </Link>

        {/* Sprint Board Card */}
        <Link href="/sprints" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-green-100 p-3 rounded-xl">
                <LayoutGrid className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-green-600 transition-colors">Sprint Board</h2>
                <p className="text-gray-500 text-sm">Agile Planning</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.sprintCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">Sprints ({stats.boardCount} boards)</div>
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
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-orange-600 transition-colors">Confluence</h2>
                <p className="text-gray-500 text-sm">Documentation & Specs</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.confluenceCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">Synced Pages</div>
          </div>
        </Link>

        {/* Operations Card - Hidden in read-only mode */}
        {!isReadOnly && (
          <Link href="/operations" className="group block">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-indigo-100 p-3 rounded-xl">
                  <Layers className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 group-hover:text-indigo-600 transition-colors">Operations</h2>
                  <p className="text-gray-500 text-sm">AI Content Queue</p>
                </div>
              </div>
              <div className="text-4xl font-black text-gray-900 mb-2">
                {stats.opsCount}
              </div>
              <div className="text-gray-400 text-sm font-medium">
                {stats.pendingOpsCount > 0 ? `${stats.pendingOpsCount} pending` : 'Operations'}
              </div>
            </div>
          </Link>
        )}

        {/* Roadmap Card */}
        <Link href="/roadmap" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-teal-100 p-3 rounded-xl">
                <Map className="w-8 h-8 text-teal-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-teal-600 transition-colors">Roadmap</h2>
                <p className="text-gray-500 text-sm">Vision & Milestones</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.visionCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">
              {stats.inProgressMilestones > 0 ? `${stats.inProgressMilestones} in progress` : `${stats.milestoneCount} milestones`}
            </div>
          </div>
        </Link>

        {/* Service Desk Card */}
        <Link href="/service-desk" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-rose-100 p-3 rounded-xl">
                <Headphones className="w-8 h-8 text-rose-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-rose-600 transition-colors">Service Desk</h2>
                <p className="text-gray-500 text-sm">PSSM Ticket Queue</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.serviceDeskTotal}
            </div>
            <div className="text-gray-400 text-sm font-medium">
              {stats.serviceDeskOpen > 0 ? `${stats.serviceDeskOpen} open` : 'Tickets'}
            </div>
          </div>
        </Link>

        {/* Members Card - Hidden in read-only mode */}
        {!isReadOnly && (
          <Link href="/members" className="group block">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-4 mb-4">
                <div className="bg-cyan-100 p-3 rounded-xl">
                  <Users className="w-8 h-8 text-cyan-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 group-hover:text-cyan-600 transition-colors">Members</h2>
                  <p className="text-gray-500 text-sm">Team Directory</p>
                </div>
              </div>
              <div className="text-4xl font-black text-gray-900 mb-2">
                {stats.memberCount}
              </div>
              <div className="text-gray-400 text-sm font-medium">
                {stats.activeMemberCount > 0 ? `${stats.activeMemberCount} active` : 'Team Members'}
              </div>
            </div>
          </Link>
        )}

        {/* Bundle Board Card */}
        <Link href="/bundles" className="group block">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-amber-100 p-3 rounded-xl">
                <Package className="w-8 h-8 text-amber-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 group-hover:text-amber-600 transition-colors">Bundle Board</h2>
                <p className="text-gray-500 text-sm">EUV Version Management</p>
              </div>
            </div>
            <div className="text-4xl font-black text-gray-900 mb-2">
              {stats.bundleCount}
            </div>
            <div className="text-gray-400 text-sm font-medium">
              {stats.activeBundleCount > 0 ? `${stats.activeBundleCount} active` : 'Bundles'}
            </div>
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