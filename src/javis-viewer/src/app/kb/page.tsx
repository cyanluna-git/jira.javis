"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Database, Eye, PencilLine, Search, Upload } from "lucide-react";
import type { Guide } from "@/lib/guides-schema";

export default function GuidesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/kb")
      .then((r) => r.json())
      .then((data) => {
        setGuides(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setGuides([]);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const values = Array.from(new Set(guides.map((g) => g.category))).sort();
    return ["All", ...values];
  }, [guides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guides.filter((g) => {
      if (category !== "All" && g.category !== category) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.author.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      );
    });
  }, [category, guides, search]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Portal
          </Link>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900">
              <Database className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-950">
                Knowledge Base
              </h1>
              <p className="text-xs text-slate-400">{guides.length} documents</p>
            </div>
          </div>
        </div>

        <Link
          href="/kb/new"
          className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or author..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-1 focus:ring-slate-200"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-slate-400"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "All" ? "All categories" : c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-slate-400">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">
            No documents found.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-3 pl-5 pr-3 text-left font-medium">#</th>
                  <th className="py-3 pr-4 text-left font-medium">Title</th>
                  <th className="hidden py-3 pr-4 text-left font-medium sm:table-cell">
                    Category
                  </th>
                  <th className="hidden py-3 pr-4 text-left font-medium md:table-cell">
                    Author
                  </th>
                  <th className="hidden py-3 pr-4 text-right font-medium lg:table-cell">
                    Updated
                  </th>
                  <th className="hidden py-3 pr-4 text-right font-medium md:table-cell">
                    Views
                  </th>
                  <th className="py-3 pr-5 text-right font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((guide, index) => (
                  <tr key={guide.id} className="group transition hover:bg-slate-50">
                    <td className="py-3.5 pl-5 pr-3 text-slate-400">{index + 1}</td>
                    <td className="py-3.5 pr-4">
                      <Link
                        href={`/kb/${guide.id}`}
                        className="font-medium text-slate-900 transition hover:text-slate-600"
                      >
                        {guide.title}
                      </Link>
                      <div className="mt-0.5 flex gap-2 text-xs text-slate-400 sm:hidden">
                        <span>{guide.category}</span>
                        <span>·</span>
                        <span>{guide.author}</span>
                      </div>
                    </td>
                    <td className="hidden py-3.5 pr-4 sm:table-cell">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {guide.category}
                      </span>
                    </td>
                    <td className="hidden py-3.5 pr-4 text-slate-500 md:table-cell">
                      {guide.author}
                    </td>
                    <td className="hidden py-3.5 pr-4 text-right text-slate-400 lg:table-cell">
                      {new Date(guide.updated_at).toLocaleDateString()}
                    </td>
                    <td className="hidden py-3.5 pr-4 text-right md:table-cell">
                      {guide.view_count !== undefined ? (
                        <span className="inline-flex items-center gap-1 text-slate-400">
                          <Eye className="h-3 w-3" />
                          {guide.view_count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                    <td className="py-3.5 pr-5 text-right">
                      {!guide.readonly && (
                        <Link
                          href={`/kb/${guide.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-500 opacity-0 transition hover:bg-slate-50 hover:text-slate-800 group-hover:opacity-100"
                        >
                          <PencilLine className="h-3 w-3" />
                          Edit
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-6 text-right">
        <Link
          href="/kb/admin"
          className="text-xs text-slate-400 transition hover:text-slate-600"
        >
          Admin →
        </Link>
      </div>
    </div>
  );
}
