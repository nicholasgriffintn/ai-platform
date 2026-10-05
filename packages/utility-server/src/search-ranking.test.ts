import { expect, it } from "vitest";

import { fuseRankedResults, toFtsQuery } from "./search-ranking";

it("quotes bounded keyword terms so search syntax cannot escape the query", () => {
  expect(toFtsQuery('rollback " OR * NOT title:secret')).toBe(
    '"rollback" OR "OR" OR "NOT" OR "title" OR "secret"',
  );
  expect(toFtsQuery(" -- * ")).toBeNull();
  expect(toFtsQuery("déploiement")).toBe('"déploiement"');
});

it("promotes passages found in both retrieval methods and ignores duplicate provider hits", () => {
  expect(
    fuseRankedResults(
      [
        [{ id: "keyword" }, { id: "both" }],
        [{ id: "semantic" }, { id: "both" }, { id: "semantic" }],
      ],
      3,
    ).map((result) => result.id),
  ).toEqual(["both", "keyword", "semantic"]);
});
