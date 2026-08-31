import "server-only";

import type { Scene } from "@liveearth/domain/types";

export function summariseOperations(
  scenes: Scene[],
  feeds: Array<{ rights_expires_at: string }>,
  now = new Date(),
) {
  const alertCutoff = now.getTime() + 30 * 24 * 60 * 60_000;
  return {
    analysisDue: scenes.filter(
      (scene) => new Date(scene.analysis.expiresAt).getTime() <= now.getTime(),
    ).length,
    rightsAlerts: feeds.filter(
      (feed) => new Date(feed.rights_expires_at).getTime() <= alertCutoff,
    ).length,
  };
}
