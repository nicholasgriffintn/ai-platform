import { describe, expect, it } from "vitest";

import { readPageNames } from "./pages/registry";
import {
  buildRouteDefinitions,
  DESKTOP_PAGE_ROUTES,
  DESKTOP_ROUTE_DEFINITIONS,
  NOT_FOUND_PAGE,
} from "./route-definitions";

describe("desktop routes", () => {
  it("gives every route it declares a page the window can render", () => {
    const components = new Set(readPageNames(import.meta.glob("./pages/*/page.tsx")));
    const declared = new Set(DESKTOP_PAGE_ROUTES.map(({ page }) => page));

    expect(declared).toEqual(components);
  });

  it("answers 404 for a chat place no page has claimed", () => {
    const definitions = buildRouteDefinitions(
      DESKTOP_PAGE_ROUTES.filter(({ page }) => page !== "files"),
    );

    expect(definitions).toContainEqual({ path: "/chat/files/*", page: NOT_FOUND_PAGE });
  });

  it("stops answering 404 for a place once a page claims it", () => {
    expect(DESKTOP_ROUTE_DEFINITIONS).toContainEqual({
      path: "/chat/files/*",
      page: "files",
      layout: "chat",
    });
    expect(DESKTOP_ROUTE_DEFINITIONS).not.toContainEqual({
      path: "/chat/files/*",
      page: NOT_FOUND_PAGE,
    });
  });
});
