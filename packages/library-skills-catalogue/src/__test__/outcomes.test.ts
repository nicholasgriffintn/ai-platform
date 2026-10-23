import { describe, expect, it } from "vitest";

import { assessSkillOutcomes } from "../outcomes.js";

const now = Date.parse("2026-10-18T12:00:00.000Z");
const base = {
  usesTotal: 12,
  usesInWindow: 4,
  thumbsUp: 2,
  thumbsDown: 0,
  corrections: 0,
  createdAt: "2026-06-01T00:00:00.000Z",
  now,
};

describe("assessSkillOutcomes", () => {
  it("calls a used skill healthy", () => {
    expect(assessSkillOutcomes(base)).toBe("healthy");
  });

  it("gives a young skill time before calling it unused", () => {
    expect(
      assessSkillOutcomes({
        ...base,
        usesTotal: 0,
        usesInWindow: 0,
        createdAt: "2026-10-10T00:00:00.000Z",
      }),
    ).toBe("new");
    expect(assessSkillOutcomes({ ...base, usesInWindow: 0 })).toBe("unused");
  });

  it("flags a skill people keep marking down, however often it runs", () => {
    expect(assessSkillOutcomes({ ...base, thumbsUp: 1, thumbsDown: 3 })).toBe("struggling");
    expect(assessSkillOutcomes({ ...base, thumbsUp: 5, thumbsDown: 3 })).toBe("healthy");
  });
});
