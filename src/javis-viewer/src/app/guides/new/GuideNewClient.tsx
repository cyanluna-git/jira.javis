"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Upload } from "lucide-react";
import { GUIDE_CATEGORY_OPTIONS } from "@/lib/guides-schema";
import MarkdownEditor from "@/components/guides/MarkdownEditor";

const HTML_MAX_BYTES = 1_048_576;

type TabMode = "markdown" | "html-upload";

interface GuideNewClientProps {
  authorName: string;
}

export default function GuideNewClient({ authorName }: GuideNewClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<TabMode>("markdown");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(GUIDE_CATEGORY_OPTIONS[0]);
  const [markdownContent, setMarkdownContent] = useState("");
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setHtmlFile(null);
      return;
    }

    if (!file.name.endsWith(".html") && !file.name.endsWith(".htm")) {
      setFileError("Only .html files are accepted.");
      setHtmlFile(null);
      event.target.value = "";
      return;
    }

    if (file.size > HTML_MAX_BYTES) {
      setFileError(`File exceeds 1 MiB limit (${(file.size / 1024).toFixed(0)} KB).`);
      setHtmlFile(null);
      event.target.value = "";
      return;
    }

    setHtmlFile(file);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!category) {
      setError("Category is required.");
      return;
    }
    if (mode === "markdown" && !markdownContent.trim()) {
      setError("Content is required.");
      return;
    }
    if (mode === "html-upload" && !htmlFile) {
      setError("Please select an HTML file.");
      return;
    }

    setSubmitting(true);

    try {
      let content: string;
      let format: "markdown" | "static-html";

      if (mode === "html-upload") {
        content = await htmlFile!.text();
        if (!content.trim()) {
          setError("The selected HTML file is empty.");
          setSubmitting(false);
          return;
        }
        format = "static-html";
      } else {
        content = markdownContent;
        format = "markdown";
      }

      const response = await fetch("/api/guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          content,
          author: authorName,
          format,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to publish guide.");
      }

      router.push(`/guides/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div>
        <Link
          href="/guides"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 transition hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Knowledge Database
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
          Upload Document
        </h1>
      </div>

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
        <button
          type="button"
          onClick={() => setMode("markdown")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "markdown"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="h-4 w-4" />
          Markdown
        </button>
        <button
          type="button"
          onClick={() => setMode("html-upload")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
            mode === "html-upload"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Upload className="h-4 w-4" />
          HTML Upload
        </button>
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

          {mode === "markdown" ? (
            <div className="space-y-2 text-sm text-slate-600">
              <span className="block font-medium">Content *</span>
              <MarkdownEditor
                value={markdownContent}
                onChange={setMarkdownContent}
                height={400}
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <span className="block font-medium">HTML File *</span>
              <div
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[28px] border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 transition hover:border-blue-300 hover:bg-blue-50/30"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-slate-400" />
                {htmlFile ? (
                  <div className="text-center">
                    <p className="font-medium text-slate-700">{htmlFile.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {(htmlFile.size / 1024).toFixed(1)} KB — click to replace
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-slate-600">Click to select a .html file</p>
                    <p className="mt-1 text-xs text-slate-400">Max 1 MiB</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm"
                onChange={handleFileChange}
                className="sr-only"
              />
              {fileError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
                  {fileError}
                </p>
              )}
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
            {submitting ? "Uploading..." : "Publish"}
          </button>
          <Link
            href="/guides"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
