import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createDemoRanking } from "@liveearth/domain/fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RankingRail } from "./ranking-rail";

const snapshot = createDemoRanking("earth", new Date("2026-08-31T05:00:00.000Z"));

afterEach(cleanup);

describe("RankingRail", () => {
  it("selects the scene represented by a ranking row", () => {
    const onSelect = vi.fn();
    const target = snapshot.entries[1];
    if (!target) throw new Error("Demo ranking needs at least two entries");

    render(
      <RankingRail
        entries={snapshot.entries}
        selectedIndex={0}
        locale="zh"
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: new RegExp(target.scene.city) }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it("makes the currently playing row explicit", () => {
    const active = snapshot.entries[0];
    if (!active) throw new Error("Demo ranking needs an entry");

    render(
      <RankingRail
        entries={snapshot.entries}
        selectedIndex={0}
        locale="zh"
        onSelect={() => undefined}
      />,
    );

    expect(
      screen.getByRole("button", { name: new RegExp(active.scene.city) }).getAttribute("aria-current"),
    ).toBe("true");
    expect(screen.getByText("播放中")).toBeTruthy();
  });
});
