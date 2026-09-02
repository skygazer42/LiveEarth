import { cleanup, render, screen } from "@testing-library/react";
import { createDemoRanking } from "@liveearth/domain/fixtures";
import type { RankingSnapshot } from "@liveearth/domain/types";
import { afterEach, describe, expect, it } from "vitest";
import { ChannelEdition } from "./channel-edition";
import { FavoritesProvider } from "./favorites-provider";

afterEach(cleanup);

describe("ChannelEdition", () => {
  it("renders the lead YouTube source as a player instead of a poster", () => {
    const base = createDemoRanking("ocean", new Date("2026-08-31T05:00:00.000Z"));
    const lead = base.entries[0];
    if (!lead) throw new Error("Demo ocean ranking needs an entry");

    const snapshot: RankingSnapshot = {
      ...base,
      entries: [
        {
          ...lead,
          scene: {
            ...lead.scene,
            media: {
              ...lead.scene.media,
              kind: "youtube",
              mode: "live",
              playbackUrl: "https://www.youtube-nocookie.com/embed/YT7lH6U68S4",
            },
          },
        },
      ],
    };

    render(
      <FavoritesProvider>
        <ChannelEdition channel="ocean" locale="zh" snapshot={snapshot} />
      </FavoritesProvider>,
    );

    const player = screen.getByTitle(`${lead.scene.city} live camera`);
    expect(player.tagName).toBe("IFRAME");
    expect(player.getAttribute("src")).toContain("youtube-nocookie.com/embed/YT7lH6U68S4");
  });
});
