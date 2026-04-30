"use client";

import dynamic from "next/dynamic";
import "@uiw/react-md-editor/markdown-editor.css";

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
  ),
});

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: number;
  preview?: "live" | "edit" | "preview";
}

export default function MarkdownEditor({
  value,
  onChange,
  height = 400,
  preview = "live",
}: MarkdownEditorProps) {
  return (
    <MDEditor
      value={value}
      onChange={(v) => onChange(v ?? "")}
      height={height}
      preview={preview}
    />
  );
}
