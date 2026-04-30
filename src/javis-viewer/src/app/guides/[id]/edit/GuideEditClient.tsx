"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileUp } from "lucide-react";
import { GUIDE_CATEGORY_OPTIONS } from "@/lib/guides-schema";
import MarkdownEditor from "@/components/guides/MarkdownEditor";

interface GuideEditClientProps {
  id: string;
  format: "markdown" | "static-html";
  initialTitle: string;
  initialCategory: string;
  initialContent: string;
  authorName: string;
}

export default function GuideEditClient({
  id,
  format,
  initialTitle,
  initialCategory,
  initialContent,
  authorName,
}: GuideEditClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialTitle);
  const [category, setCategory] = useState(initialCategory);
  const [content, setContent] = useState(initialContent);
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    let nextContent: string | undefined;

    if (format === "static-html") {
      if (htmlFile) {
        nextContent = await htmlFile.text();
        if (!nextContent.includes("<")) {
          setError("Selected file does not appear to be valid HTML.");
          return;
        }
      }
    } else {
      if (!content.trim()) {
        setError("Content is required.");
        return;
      }
      nextContent = content;
    }

    setSubmitting(true);

    try {
      const body: Record<string, string> = {
        title: title.trim(),
        category,
        author: authorName,
        format,
      };
      if (nextContent !== undefined) {
        body.content = nextContent;
      }

      const response = await fetch(`/api/guides/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to save guide.");
      }

      router.push(`/guides/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <Link
          href={`/guides/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-blue-600"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Guide
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Edit Document
        </h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-40px_rgba(15,23,42,0.45)] sm:p-8"
      >
        <div className="space-y-5">
          <label className="block space-y-2 text-sm text-slate-600">
            <span className="font-medium">Title *</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Guide title"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="font-medium">Category *</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {GUIDE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          {format === "static-html" ? (
            <div className="space-y-2 text-sm text-slate-600">
              <span className="block font-medium">
                Replace HTML File{" "}
                <span className="font-normal text-slate-400">
                  (optional — leave empty to keep existing)
                </span>
              </span>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 transition hover:border-blue-300 hover:bg-blue-50/30"
              >
                <FileUp className="h-8 w-8 text-slate-400" />
                {htmlFile ? (
                  <span className="font-medium text-slate-700">{htmlFile.name}</span>
                ) : (
                  <span className="text-center text-slate-400">
                    Click to select a new HTML file
                    <br />
                    <span className="text-xs">Leave empty to keep existing content</span>
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,text/html"
                className="hidden"
                onChange={(e) => setHtmlFile(e.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <span className="block font-medium">Content *</span>
              <MarkdownEditor
                value={content}
                onChange={setContent}
                height={400}
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
          <Link
            href={`/guides/${id}`}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
