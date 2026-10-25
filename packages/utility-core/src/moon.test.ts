import { describe, expect, it } from "vitest";

import { moonLitPath, moonPhase } from "./moon.js";

describe("moonPhase", () => {
  it("places known new and full moons at the start and middle of the cycle", () => {
    const newMoon = moonPhase(new Date("2024-01-11T11:57:00Z"));
    const fullMoon = moonPhase(new Date("2024-01-25T17:54:00Z"));

    expect(Math.min(newMoon, 1 - newMoon)).toBeLessThan(0.02);
    expect(fullMoon).toBeCloseTo(0.5, 1);
  });
});

describe("moonLitPath", () => {
  it("lights the right side while waxing and the left while waning", () => {
    expect(moonLitPath(0.1, 50, 50, 10)).toContain("A 10 10 0 0 1 50 60");
    expect(moonLitPath(0.9, 50, 50, 10)).toContain("A 10 10 0 0 0 50 60");
  });
});
