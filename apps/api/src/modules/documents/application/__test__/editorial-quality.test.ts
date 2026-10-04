import { describe, expect, it } from "vitest";

import {
  EDITORIAL_DIMENSIONS,
  editorialGrade,
  weightedEditorialScore,
  type EditorialScores,
} from "../editorial-quality";

function scores(value: number): EditorialScores {
  return Object.fromEntries(
    EDITORIAL_DIMENSIONS.map((dimension) => [dimension, value]),
  ) as EditorialScores;
}

describe("weightedEditorialScore", () => {
  it("weights every dimension and nothing else, so a uniform score round-trips", () => {
    expect(weightedEditorialScore(scores(1))).toBeCloseTo(1);
    expect(weightedEditorialScore(scores(0))).toBe(0);
    expect(weightedEditorialScore(scores(0.5))).toBeCloseTo(0.5);
  });

  it("lets clarity and specificity move the overall more than structure", () => {
    const clearButUnstructured = { ...scores(0), clarity: 1, specificity: 1 };
    const structuredButUnclear = { ...scores(0), structure: 1, usefulness: 1 };

    expect(weightedEditorialScore(clearButUnstructured)).toBeGreaterThan(
      weightedEditorialScore(structuredButUnclear),
    );
  });
});

describe("editorialGrade", () => {
  it("maps the overall score onto bands without leaving a gap", () => {
    expect(editorialGrade(1)).toBe("A");
    expect(editorialGrade(0.85)).toBe("A");
    expect(editorialGrade(0.84)).toBe("B");
    expect(editorialGrade(0.7)).toBe("B");
    expect(editorialGrade(0.69)).toBe("C");
    expect(editorialGrade(0.55)).toBe("C");
    expect(editorialGrade(0.4)).toBe("D");
    expect(editorialGrade(0.39)).toBe("E");
    expect(editorialGrade(0)).toBe("E");
  });
});
