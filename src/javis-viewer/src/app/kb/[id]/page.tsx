import Link from "next/link";
import { ArrowLeft, Eye, PencilLine, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "@/components/guides/MermaidBlock";
import { ViewTracker } from "@/components/guides/ViewTracker";
import { getGuide } from "@/lib/guides-store";
import { resolveServerAccessContext, hasWriteCapability } from "@/lib/access";

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [guide, access] = await Promise.all([
    getGuide(id),
    resolveServerAccessContext(),
  ]);

  if (!guide) {
    notFound();
  }

  const canWrite = hasWriteCapability(access, "general");

  if (guide.format === "static-html") {
    const mermaidScript = `<script src="/vendor/mermaid.min.js"></script><script>mermaid.initialize({startOnLoad:true,theme:'default'});</script>`;
    const srcDoc = guide.content.includes("</head>")
      ? guide.content.replace("</head>", `${mermaidScript}</head>`)
      : mermaidScript + guide.content;
    return (
      <>
        <ViewTracker id={id} />
        {canWrite && !guide.readonly && (
          <Link
            href={`/kb/${id}/edit`}
            className="fixed right-4 top-4 z-50 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-md backdrop-blur-sm transition hover:border-blue-200 hover:text-blue-600"
          >
            <PencilLine className="h-4 w-4" />
            Replace HTML
          </Link>
        )}
        <iframe
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin"
          style={{ width: "100vw", height: "100vh", border: "none", display: "block" }}
          title={guide.title}
        />
      </>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <ViewTracker id={id} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/kb"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to KB
        </Link>
        <div className="flex items-center gap-2">
          {canWrite && !guide.readonly && (
            <Link
              href={`/kb/${id}/edit`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
            >
              <PencilLine className="h-4 w-4" />
              Edit
            </Link>
          )}
          <Link
            href="/kb/admin"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:text-blue-600"
          >
            <ShieldCheck className="h-4 w-4" />
            Open Admin
          </Link>
        </div>
      </div>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] sm:p-8">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
            {guide.category}
          </span>
          <span>Updated {new Date(guide.updated_at).toLocaleDateString()}</span>
          <span>by {guide.author}</span>
          {guide.view_count !== undefined && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {guide.view_count.toLocaleString()}
            </span>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          {guide.title}
        </h1>
        <div className="prose prose-slate mt-8 max-w-none prose-headings:tracking-tight prose-a:text-blue-600 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-slate-900 prose-pre:text-slate-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const lang = /language-(\w+)/.exec(className ?? "")?.[1];
                if (lang === "mermaid") {
                  return (
                    <MermaidBlock chart={String(children).replace(/\n$/, "")} />
                  );
                }
                return <code className={className}>{children}</code>;
              },
            }}
          >
            {guide.content}
          </ReactMarkdown>
        </div>
      </section>
    </div>
  );
}
