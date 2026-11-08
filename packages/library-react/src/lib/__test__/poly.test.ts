import { POLY_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getPolyNavigationHref, readPolyNavigationTarget } from "../poly.js";

describe("meta navigation", () => {
  it("opens Work Files, Teammates, Plugins and Scheduled under their authorised project", () => {
    for (const place of ["files", "teammates", "plugins", "scheduled"] as const) {
      expect(
        getPolyNavigationHref({
          kind: "place",
          mode: "work",
          place,
          workspaceId: "w1",
          projectId: "p1",
        }),
      ).toBe(`/work/w1/projects/p1/${place}`);
      expect(getPolyNavigationHref({ kind: "place", mode: "work", place })).toBe("/work");
    }
  });

  it("only reads well-formed navigation data", () => {
    expect(
      readPolyNavigationTarget({ [POLY_NAVIGATION_DATA_KEY]: { kind: "place", place: "files" } }),
    ).toEqual({ kind: "place", place: "files", mode: "chat" });
    expect(readPolyNavigationTarget({ [POLY_NAVIGATION_DATA_KEY]: { kind: "nope" } })).toBeNull();
    expect(readPolyNavigationTarget(undefined)).toBeNull();
  });
});
