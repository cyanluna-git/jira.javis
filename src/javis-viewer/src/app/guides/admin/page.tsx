"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Search, Trash2, Upload } from "lucide-react";
import type { Guide } from "@/lib/guides-schema";

export default function GuideAdminPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [search, setSearch] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function loadGuides() {
    const res = await fetch("/api/guides");
    const data = await res.json();
    setGuides(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("portal-guide-admin-token");
    if (stored) setAdminToken(stored);
    loadGuides()
      .catch(() => setMessage({ text: "Failed to load documents.", type: "err" }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("portal-guide-admin-token", adminToken);
  }, [adminToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guides;
    return guides.filter(
      (g) =>
        g.title.toLowerCase().includes(q) || g.author.toLowerCase().includes(q),
    );
  }, [guides, search]);

  async function handleDelete(id: string) {
    setDeleting(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/guides/${id}`, {
        method: "DELETE",
        headers: { "x-portal-admin-token": adminToken },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed.");
      }
      setMessage({ text: "Document deleted.", type: "ok" });
      await loadGuides();
    } catch (err) {
      setMessage({
        text: err instanceof Error ? err.message : "Delete failed.",
        type: "err",
      });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/guides"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Knowledge Database
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                Admin
              </h1>
              <p className="text-xs text-slate-400">Manage and delete documents</p>
            </div>
          </div>
        </div>

        <Link
          href="/guides/new"
          className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Link>
      </div>

      <div className="mt-6">
        <label className="block space-y-1.5 text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Admin Token (required for delete)
          </span>
          <input
            type="password"
            value={adminToken}
            onChange={(e) => setAdminToken(e.target.value)}
            placeholder="x-portal-admin-token"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
          />
        </label>
      </div>

      <div className="relative mt-4">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by title or author..."
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
        />
      </div>

      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            message.type === "ok"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No documents found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {filtered.map((guide) => (
              <div
                key={guide.id}
                className="flex items-center justify-between gap-4 px-5 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/guides/${guide.id}`}
                    className="text-sm font-medium text-slate-900 transition hover:text-slate-600"
                  >
                    {guide.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span>{guide.category}</span>
                    <span>·</span>
                    <span>{guide.author}</span>
                    <span>·</span>
                    <span>{new Date(guide.updated_at).toLocaleDateString()}</span>
                    {guide.readonly && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
                        Read-only
                      </span>
                    )}
                    {guide.format === "static-html" && !guide.readonly && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                        HTML
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {!guide.readonly && (
                    <Link
                      href={`/guides/${guide.id}/edit`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                    >
                      Edit
                    </Link>
                  )}
                  {!guide.readonly && (
                    <button
                      onClick={() => handleDelete(guide.id)}
                      disabled={deleting === guide.id || !adminToken}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {deleting === guide.id ? "Deleting…" : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
