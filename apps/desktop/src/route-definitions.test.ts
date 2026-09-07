import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";

import { readPageNames } from "./pages/registry";
import {
  buildRouteDefinitions,
  DESKTOP_PAGE_ROUTES,
  DESKTOP_ROUTE_DEFINITIONS,
  NOT_FOUND_PAGE,
} from "./route-definitions";

function pageFor(pathname: string): string | undefined {
  const matches = matchRoutes(
    DESKTOP_ROUTE_DEFINITIONS.map(({ path, page }) => ({ path, id: `${page}:${path}` })),
    pathname,
  );

  return matches?.at(-1)?.route.id?.split(":")[0];
}

describe("desktop routes", () => {
  it("serves the conversation surface for personal chat paths", () => {
    expect(pageFor("/chat")).toBe("chat");
    expect(pageFor("/chat/abc-123")).toBe("chat");
  });

  it("sends the window to chat from the root", () => {
    expect(pageFor("/")).toBe("root");
  });

  it.each(["/chat/files", "/chat/files/made", "/chat/files/made/nested/path"])(
    "serves the Files place at %s",
    (pathname) => {
      expect(pageFor(pathname)).toBe("files");
    },
  );

  it("serves the Attention place", () => {
    expect(pageFor("/chat/attention")).toBe("attention");
  });

  it("serves the Teammates place and the surfaces it links to", () => {
    expect(pageFor("/chat/teammates")).toBe("teammates");
    expect(pageFor("/chat/teammates/poly")).toBe("teammate");
    expect(pageFor("/chat/tools/search")).toBe("tools");
  });

  it("serves the Apps place and the runtimes it routes into", () => {
    expect(pageFor("/chat/apps/notes")).toBe("apps");
    expect(pageFor("/chat/apps/notes/entry")).toBe("apps");
    expect(pageFor("/chat/apps/replicate/predictions/abc")).toBe("apps");
  });

  it.each(["/work", "/work/acme/projects/p1", "/models", "/apps", "/pets", "/profile", "/pricing"])(
    "answers 404 for the route %s this window does not serve",
    (pathname) => {
      expect(pageFor(pathname)).toBe(NOT_FOUND_PAGE);
    },
  );

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
    expect(DESKTOP_ROUTE_DEFINITIONS).toContainEqual({ path: "/chat/files/*", page: "files" });
    expect(DESKTOP_ROUTE_DEFINITIONS).not.toContainEqual({
      path: "/chat/files/*",
      page: NOT_FOUND_PAGE,
    });
  });
});
