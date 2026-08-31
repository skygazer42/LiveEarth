"use client";

import { useEffect, useState } from "react";
import { isSceneEligible } from "@liveearth/domain/ranking";
import type { RankingSnapshot } from "@liveearth/domain/types";

const POLL_INTERVAL_MS = 30_000;

export function useRankingSnapshot(initialSnapshot: RankingSnapshot) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let controller: AbortController | undefined;

    async function refresh() {
      controller = new AbortController();
      try {
        const response = await fetch(`/api/v1/rankings/${initialSnapshot.channel}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Ranking refresh returned ${response.status}`);
        const next = (await response.json()) as RankingSnapshot;
        if (!cancelled && next.channel === initialSnapshot.channel && Array.isArray(next.entries)) {
          setSnapshot(next);
        }
      } catch {
        if (!cancelled) {
          setSnapshot((current) => ({
            ...current,
            entries: current.entries.filter((entry) => isSceneEligible(entry.scene)),
          }));
        }
      } finally {
        if (!cancelled) timer = window.setTimeout(refresh, POLL_INTERVAL_MS);
      }
    }

    timer = window.setTimeout(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
      controller?.abort();
    };
  }, [initialSnapshot.channel]);

  return snapshot;
}
