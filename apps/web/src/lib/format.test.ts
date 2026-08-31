import { describe, expect, it } from "vitest";
import { channelLabel, formatCoordinates, trendGlyph } from "./format";

describe("presentation formatting", () => {
  it("formats coordinates with hemisphere markers", () => {
    expect(formatCoordinates(62.0079, -6.79)).toBe("62.01°N  6.79°W");
    expect(formatCoordinates(-33.9249, 18.4241)).toBe("33.92°S  18.42°E");
  });

  it("localises channel labels", () => {
    expect(channelLabel("storm", "en")).toBe("Storm");
    expect(channelLabel("night", "zh")).toBe("夜色");
  });

  it("uses compact accessible trend glyphs", () => {
    expect(trendGlyph("up")).toBe("↑");
    expect(trendGlyph("steady")).toBe("—");
  });
});
