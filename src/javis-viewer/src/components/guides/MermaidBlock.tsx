"use client";

import { useEffect, useId, useState } from "react";

export function MermaidBlock({ chart }: { chart: string }) {
  const baseId = useId();
  const mermaidId = `mermaid${baseId.replace(/:/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("mermaid")
      .then(({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, theme: "default" });
        return mermaid.render(mermaidId, chart);
      })
      .then(({ svg: renderedSvg }) => {
        if (!cancelled) setSvg(renderedSvg);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [chart, mermaidId]);

  if (error) {
    return (
      <pre className="my-4 whitespace-pre-wrap rounded bg-red-50 p-4 text-sm text-red-700">
        {`Mermaid render error:\n${error}`}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 h-20 animate-pulse rounded border border-slate-200 bg-slate-50" />
    );
  }

  return (
    <div
      className="my-4 overflow-x-auto rounded border border-slate-100 p-2 [&_svg]:mx-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
