import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import SearchContent from "./SearchContent";

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

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

interface SearchResults {
  results: SearchResult[];
  total: number;
}

async function searchJira(query: string, page: number): Promise<SearchResults> {
  if (!query || query.length < 2) return { results: [], total: 0 };

  const client = await pool.connect();
  try {
    const searchPattern = `%${query}%`;
    const offset = (page - 1) * PAGE_SIZE;

    // Get total count
    const countRes = await client.query(`
      SELECT COUNT(*) as total
      FROM jira_issues
      WHERE
        key ILIKE $1
        OR summary ILIKE $1
        OR raw_data->'fields'->>'description' ILIKE $1
    `, [searchPattern]);

    const total = parseInt(countRes.rows[0].total);

    // Get paginated results
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
      LIMIT $2 OFFSET $3
    `, [searchPattern, PAGE_SIZE, offset]);

    return {
      results: res.rows.map(row => ({
        type: 'jira' as const,
        key: row.key,
        summary: row.summary,
        status: row.status,
        project: row.project,
        assignee: row.assignee,
        updated: row.updated,
        matchField: row.match_field,
      })),
      total,
    };
  } finally {
    client.release();
  }
}

async function searchConfluence(query: string, page: number): Promise<SearchResults> {
  if (!query || query.length < 2) return { results: [], total: 0 };

  const client = await pool.connect();
  try {
    const searchPattern = `%${query}%`;
    const offset = (page - 1) * PAGE_SIZE;

    // Get total count
    const countRes = await client.query(`
      SELECT COUNT(*) as total
      FROM confluence_v2_content
      WHERE
        type = 'page'
        AND (
          title ILIKE $1
          OR raw_data->'body'->'storage'->>'value' ILIKE $1
        )
    `, [searchPattern]);

    const total = parseInt(countRes.rows[0].total);

    // Get paginated results
    const res = await client.query(`
      SELECT
        id,
        title,
        space_id,
        space_id as space_name,
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
      LIMIT $2 OFFSET $3
    `, [searchPattern, PAGE_SIZE, offset]);

    return {
      results: res.rows.map(row => ({
        type: 'confluence' as const,
        id: row.id,
        title: row.title,
        spaceKey: row.space_id,
        spaceName: row.space_name,
        updated: row.updated || '',
        excerpt: row.excerpt?.replace(/<[^>]*>/g, '').substring(0, 150) || '',
      })),
      total,
    };
  } finally {
    client.release();
  }
}

interface Props {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q || '';
  const filter = params.filter || 'all';
  const page = params.page ? parseInt(params.page) : 1;

  try {
    let jiraResults: SearchResult[] = [];
    let confluenceResults: SearchResult[] = [];
    let jiraTotal = 0;
    let confluenceTotal = 0;

    if (query.length >= 2) {
      if (filter === 'all') {
        const [jiraData, confData] = await Promise.all([
          searchJira(query, page),
          searchConfluence(query, page),
        ]);
        jiraResults = jiraData.results;
        confluenceResults = confData.results;
        jiraTotal = jiraData.total;
        confluenceTotal = confData.total;
      } else if (filter === 'jira') {
        const data = await searchJira(query, page);
        jiraResults = data.results;
        jiraTotal = data.total;
      } else if (filter === 'confluence') {
        const data = await searchConfluence(query, page);
        confluenceResults = data.results;
        confluenceTotal = data.total;
      }
    }

    const totalResults = filter === 'all'
      ? jiraTotal + confluenceTotal
      : filter === 'jira'
        ? jiraTotal
        : confluenceTotal;

    const totalPages = Math.ceil(totalResults / PAGE_SIZE);

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
            currentPage={page}
            totalPages={totalPages}
            totalResults={totalResults}
            jiraResults={jiraResults}
            confluenceResults={confluenceResults}
            jiraTotal={jiraTotal}
            confluenceTotal={confluenceTotal}
            pageSize={PAGE_SIZE}
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
