import { describe, expect, it } from "vitest";

import { buildCatalogueParamsPatch, readCatalogueFilters } from "../capability-catalogue-params.js";

describe("capability catalogue params", () => {
  it("falls back to the first offered type when the URL names another", () => {
    const params = new URLSearchParams("type=teammate&show=installed&category=CRM&q=mail");

    expect(readCatalogueFilters(params, ["connector", "skill"])).toEqual({
      kind: "connector",
      installed: true,
      category: "CRM",
      query: "mail",
    });
  });

  it("clears defaults from the URL instead of writing them", () => {
    expect(
      buildCatalogueParamsPatch({ kind: null, installed: false, category: "all", query: "" }),
    ).toEqual({ type: null, show: null, category: null, q: null });
  });
});
