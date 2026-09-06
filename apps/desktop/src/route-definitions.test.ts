import { matchRoutes } from "react-router";
import { describe, expect, it } from "vitest";

import { DESKTOP_ROUTE_DEFINITIONS, type DesktopPage } from "./route-definitions";

function pageFor(pathname: string): DesktopPage | undefined {
  const matches = matchRoutes(
    DESKTOP_ROUTE_DEFINITIONS.map(({ path, page }) => ({ path, id: page })),
    pathname,
  );

  return matches?.at(-1)?.route.id;
}

describe("desktop routes", () => {
  it("serves the conversation surface for personal chat paths", () => {
    expect(pageFor("/chat")).toBe("chat");
    expect(pageFor("/chat/abc-123")).toBe("chat");
  });

  it("sends the window to chat from the root", () => {
    expect(pageFor("/")).toBe("redirect-to-chat");
  });

  it.each([
    "/chat/attention",
    "/chat/files",
    "/chat/files/nested/path",
    "/chat/teammates",
    "/chat/teammates/poly",
    "/chat/apps/notes/entry",
    "/chat/tools/search",
  ])("does not read the unmigrated chat route %s as a conversation", (pathname) => {
    expect(pageFor(pathname)).toBe("not-found");
  });

  it.each(["/work", "/work/acme/projects/p1", "/models", "/apps", "/pets", "/profile", "/pricing"])(
    "answers 404 for the unmigrated route %s",
    (pathname) => {
      expect(pageFor(pathname)).toBe("not-found");
    },
  );
});
