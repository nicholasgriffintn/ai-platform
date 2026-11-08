import { expect, it } from "vitest";

import { toFtsQuery } from "./search-ranking";

it("quotes bounded keyword terms so search syntax cannot escape the query", () => {
  expect(toFtsQuery('rollback " OR * NOT title:secret')).toBe(
    '"rollback" OR "OR" OR "NOT" OR "title" OR "secret"',
  );
  expect(toFtsQuery(" -- * ")).toBeNull();
  expect(toFtsQuery("déploiement")).toBe('"déploiement"');
});
