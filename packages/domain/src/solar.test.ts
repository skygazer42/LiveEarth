import { describe, expect, it } from "vitest";
import { isAfterCivilDusk, solarAltitudeDegrees } from "./solar";

describe("solar position", () => {
  it("recognises local noon and midnight near the equator", () => {
    const noon = solarAltitudeDegrees(new Date("2026-03-20T12:00:00.000Z"), 0, 0);
    const midnight = solarAltitudeDegrees(new Date("2026-03-20T00:00:00.000Z"), 0, 0);
    expect(noon).toBeGreaterThan(80);
    expect(midnight).toBeLessThan(-80);
  });

  it("uses civil dusk as the Night publishing threshold", () => {
    expect(isAfterCivilDusk(new Date("2026-03-20T00:00:00.000Z"), 0, 0)).toBe(true);
    expect(isAfterCivilDusk(new Date("2026-03-20T12:00:00.000Z"), 0, 0)).toBe(false);
  });
});
