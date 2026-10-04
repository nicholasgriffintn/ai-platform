import { describe, expect, it } from "vitest";

import {
  buildExpansionQuestions,
  MAX_EXPANSION_QUERIES,
  normaliseCandidates,
  selectExpansionQueries,
} from "../query-expansion";

const candidates = ["cost of X in 2026", "X safety record", "X vs Y"];

function noulAnswers(values: number[]) {
  return Object.fromEntries(
    values.map((noul, index) => [`candidate_${index}`, { type: "noul", noul }]),
  );
}

describe("normaliseCandidates", () => {
  it("drops the original query, blanks and duplicates", () => {
    expect(
      normaliseCandidates(["How much is X", "", "  how much is X  ", "X safety"], "How much is X"),
    ).toEqual(["X safety"]);
  });

  it("caps how many candidates reach the model", () => {
    const many = Array.from({ length: 30 }, (_, index) => `query ${index}`);

    expect(normaliseCandidates(many, "original")).toHaveLength(8);
  });
});

describe("buildExpansionQuestions", () => {
  it("asks one yes/no per candidate in a single request", () => {
    const questions = buildExpansionQuestions(candidates);

    expect(Object.keys(questions)).toEqual(["candidate_0", "candidate_1", "candidate_2"]);
    expect(questions.candidate_0.type).toBe("noul");
  });
});

describe("selectExpansionQueries", () => {
  it("runs only the follow-ups that would reach evidence the original misses", () => {
    expect(selectExpansionQueries(candidates, noulAnswers([0.95, 0.3, 0.8]))).toEqual([
      "cost of X in 2026",
      "X vs Y",
    ]);
  });

  it("searches once more at most twice, however many look promising", () => {
    expect(selectExpansionQueries(candidates, noulAnswers([0.99, 0.98, 0.97]))).toHaveLength(
      MAX_EXPANSION_QUERIES,
    );
  });

  it("adds no searches when nothing clears the bar", () => {
    expect(selectExpansionQueries(candidates, noulAnswers([0.5, 0.2, 0.69]))).toEqual([]);
  });
});
