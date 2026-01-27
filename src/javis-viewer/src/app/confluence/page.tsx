import Link from "next/link";
import pool from "@/lib/db";
import { ArrowLeft, FileText, ChevronRight } from "lucide-react";
import clsx from "clsx";

export const dynamic = 'force-dynamic';

async function getPages() {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT id, title FROM confluence_v2_content WHERE type = \'page\' ORDER BY title ASC');
    return res.rows;
  } finally {
    client.release();
  }
}

async function getPageContent(id: string) {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT title, body_storage, web_url FROM confluence_v2_content WHERE id = $1', [id]);
    return res.rows[0];
  } finally {
    client.release();
  }
}

export default async function ConfluencePage({
  searchParams,
}: {
  searchParams: Promise<{ pageId?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const pageId = resolvedSearchParams.pageId;
  const pages = await getPages();
  const activePage = pageId ? await getPageContent(pageId) : null;

  return (
    <div className="flex h-screen bg-white font-sans overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3 bg-white">
          <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </Link>
          <h1 className="font-bold text-gray-800">Pages</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {pages.map((p) => (
            <Link
              key={p.id}
              href={`/confluence?pageId=${p.id}`}
              className={clsx(
                "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors truncate",
                pageId === p.id
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-200/50"
              )}
            >
              <FileText className="w-4 h-4 flex-shrink-0 opacity-70" />
              <span className="truncate">{p.title}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activePage ? (
          <>
            <div className="p-6 border-b border-gray-200 bg-white flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{activePage.title}</h2>
                <a 
                    href={activePage.web_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                    Open in Confluence <ChevronRight className="w-4 h-4" />
                </a>
            </div>
            <div className="flex-1 overflow-y-auto p-8 bg-white">
              <div 
                className="prose prose-blue max-w-4xl mx-auto"
                dangerouslySetInnerHTML={{ __html: activePage.body_storage }}
              />
            </div>
          </>
        ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Select a page from the sidebar to view content.</p>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
