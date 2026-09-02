import { renderToStaticMarkup } from "react-dom/server";
import { createDemoRanking } from "@liveearth/domain/fixtures";
import { describe, expect, it } from "vitest";
import { LivePlayer } from "./live-player";

describe("LivePlayer", () => {
  it("includes an MP4 source in server-rendered HTML", () => {
    const snapshot = createDemoRanking("storm", new Date("2026-08-31T05:00:00.000Z"));
    const entry = snapshot.entries[0];
    if (!entry) throw new Error("Demo storm ranking needs an entry");
    const playbackUrl = "https://cdn.example.test/current-loop.mp4";
    const scene = {
      ...entry.scene,
      media: {
        ...entry.scene.media,
        kind: "mp4" as const,
        mode: "near-live" as const,
        playbackUrl,
      },
    };

    const html = renderToStaticMarkup(<LivePlayer scene={scene} muted />);

    expect(html).toContain(`src="${playbackUrl}"`);
    expect(html).toContain("<video");
  });
});
