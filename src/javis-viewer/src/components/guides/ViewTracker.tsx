"use client";

import { useEffect, useRef } from "react";

export function ViewTracker({ id }: { id: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fetch(`/api/guides/${id}/view`, { method: "POST" }).catch(() => {});
  }, [id]);
  return null;
}
