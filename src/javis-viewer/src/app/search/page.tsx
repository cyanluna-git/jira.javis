import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import SearchContent from "./SearchContent";

export const dynamic = 'force-dynamic';

interface JiraResult {
  type: 'jira';
  key: string;
  summary: string;
  status: string;
  project: string;
  assignee: string | null;
  updated: string;
  matchField: string;
}

interface ConfluenceResult {
  type: 'confluence';
  id: string;
  title: string;
  spaceKey: string;
  spaceName: string;
  updated: string;
  excerpt: string;
}

type SearchResult = JiraResult | ConfluenceResult;

async function searchJira(query: string, limit: number): Promise<JiraResult[]> {
  if (!query || query.length < 2) return [];

  const client = await pool.connect();
  try {
    const searchPattern = `%${query}%`;
    const res = await client.query(`
      SELECT
        key,
        summary,
        status,
        project,
        raw_data->'fields'->'assignee'->>'displayName' as assignee,
        raw_data->'fields'->>'updated' as updated,
        CASE
          WHEN key ILIKE $1 THEN 'key'
          WHEN summary ILIKE $1 THEN 'summary'
          ELSE 'description'
        END as match_field
      FROM jira_issues
      WHERE
        key ILIKE $1
        OR summary ILIKE $1
        OR raw_data->'fields'->>'description' ILIKE $1
      ORDER BY
        CASE WHEN key ILIKE $1 THEN 0 ELSE 1 END,
        (raw_data->'fields'->>'updated')::timestamp DESC
      LIMIT $2
    `, [searchPattern, limit]);

    return res.rows.map(row => ({
      type: 'jira' as const,
      key: row.key,
      summary: row.summary,
      status: row.status,
      project: row.project,
      assignee: row.assignee,
      updated: row.updated,
      matchField: row.match_field,
    }));
  } finally {
    client.release();
  }
}

async function searchConfluence(query: string, limit: number): Promise<ConfluenceResult[]> {
  if (!query || query.length < 2) return [];

  const client = await pool.connect();
  try {
    const searchPattern = `%${query}%`;
    const res = await client.query(`
      SELECT
        id,
        title,
        space_key,
        space_key as space_name,
        raw_data->>'_expandable' as updated,
        COALESCE(
          SUBSTRING(raw_data->'body'->'storage'->>'value' FROM 1 FOR 200),
          ''
        ) as excerpt
      FROM confluence_v2_content
      WHERE
        type = 'page'
        AND (
          title ILIKE $1
          OR raw_data->'body'->'storage'->>'value' ILIKE $1
        )
      ORDER BY
        CASE WHEN title ILIKE $1 THEN 0 ELSE 1 END,
        title
      LIMIT $2
    `, [searchPattern, limit]);

    return res.rows.map(row => ({
      type: 'confluence' as const,
      id: row.id,
      title: row.title,
      spaceKey: row.space_key,
      spaceName: row.space_name,
      updated: row.updated || '',
      excerpt: row.excerpt?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
    }));
  } finally {
    client.release();
  }
}

interface Props {
  searchParams: Promise<{ q?: string; filter?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q || '';
  const filter = params.filter || 'all'; // 'all' | 'jira' | 'confluence'

  try {
    let jiraResults: JiraResult[] = [];
    let confluenceResults: ConfluenceResult[] = [];

    if (query.length >= 2) {
      const limit = filter === 'all' ? 15 : 30;

      // Execute searches in parallel for better performance
      if (filter === 'all') {
        [jiraResults, confluenceResults] = await Promise.all([
          searchJira(query, limit),
          searchConfluence(query, limit),
        ]);
      } else if (filter === 'jira') {
        jiraResults = await searchJira(query, limit);
      } else if (filter === 'confluence') {
        confluenceResults = await searchConfluence(query, limit);
      }
    }

    // Combine and sort results for 'all' filter
    let combinedResults: SearchResult[] = [];
    if (filter === 'all') {
      combinedResults = [...jiraResults, ...confluenceResults];
    }

    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Search</h1>
          </div>

          <SearchContent
            initialQuery={query}
            initialFilter={filter}
            jiraResults={jiraResults}
            confluenceResults={confluenceResults}
            combinedResults={combinedResults}
          />
        </div>
      </div>
    );
  } catch (error) {
    console.error('Search error:', error);
    return (
      <div className="min-h-screen bg-gray-50 p-8 font-sans">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-center gap-4">
            <Link href="/" className="p-2 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Search</h1>
          </div>
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center">
            <p className="text-red-600 font-medium">Search failed</p>
            <p className="text-gray-500 text-sm mt-2">Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }
}
