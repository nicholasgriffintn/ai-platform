import { describe, expect, it } from "vitest";

import { describeWindowTitle, readTitledPages } from "./lib/window-title";
import { readPageNames } from "./pages/registry";
import {
  buildRouteDefinitions,
  DESKTOP_PAGE_ROUTES,
  DESKTOP_ROUTE_DEFINITIONS,
  NOT_FOUND_PAGE,
  readPageForPath as pageFor,
} from "./route-definitions";

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

  it("serves the Work overview and the workspace surfaces beneath it", () => {
    expect(pageFor("/work")).toBe("work");
    expect(pageFor("/work/attention")).toBe("work-attention");
    expect(pageFor("/work/invitations")).toBe("work-invitations");
    expect(pageFor("/work/acme")).toBe("workspace");
    expect(pageFor("/work/acme/members")).toBe("workspace-members");
    expect(pageFor("/work/acme/governance")).toBe("workspace-governance");
  });

  it("serves every project surface Work links to", () => {
    const project = "/work/acme/projects/p1";

    expect(pageFor(project)).toBe("project");
    expect(pageFor(`${project}/settings`)).toBe("project-settings");
    expect(pageFor(`${project}/chat`)).toBe("project-chat");
    expect(pageFor(`${project}/chat/c1`)).toBe("project-chat");
    expect(pageFor(`${project}/teammates`)).toBe("project-teammates");
    expect(pageFor(`${project}/teammates/poly`)).toBe("project-teammate");
    expect(pageFor(`${project}/apps/notes/entry`)).toBe("project-app");
    expect(pageFor(`${project}/files/made/nested`)).toBe("project-files");
    expect(pageFor(`${project}/tasks`)).toBe("project-tasks");
    expect(pageFor(`${project}/tasks/t1`)).toBe("project-task");
    expect(pageFor(`${project}/activity`)).toBe("project-activity");
    expect(pageFor(`${project}/tools/search`)).toBe("project-tool");
  });

  it("serves the places the sidebar links to outside a product mode", () => {
    expect(pageFor("/profile")).toBe("profile");
    expect(pageFor("/discover")).toBe("discover");
    expect(pageFor("/models")).toBe("models");
    expect(pageFor("/apps")).toBe("catalogue");
    expect(pageFor("/pets")).toBe("pets");
    expect(pageFor("/pricing")).toBe("pricing");
    expect(pageFor("/terms")).toBe("terms");
    expect(pageFor("/privacy")).toBe("privacy");
  });

  it.each(["/downloads", "/s/share-id", "/auth/callback"])(
    "answers 404 for the web-only route %s this window does not serve",
    (pathname) => {
      expect(pageFor(pathname)).toBe(NOT_FOUND_PAGE);
    },
  );

  it("gives every route it declares a page the window can render", () => {
    const components = new Set(readPageNames(import.meta.glob("./pages/*/page.tsx")));
    const declared = new Set(DESKTOP_PAGE_ROUTES.map(({ page }) => page));

    expect(declared).toEqual(components);
  });

  it.each([
    "/",
    "/apps",
    "/chat",
    "/discover",
    "/models",
    "/pets",
    "/pricing",
    "/privacy",
    "/profile",
    "/terms",
    "/work",
  ])("serves %s, which the shared sidebars and settings link to", (pathname) => {
    expect(pageFor(pathname)).not.toBe(NOT_FOUND_PAGE);
  });

  it("names every page it serves in the window title", () => {
    const titled = new Set(readTitledPages());

    for (const { page } of DESKTOP_PAGE_ROUTES) {
      expect(titled).toContain(page);
    }
  });

  it("names the place the window is showing", () => {
    expect(describeWindowTitle(pageFor("/work/acme/projects/p1/tasks"))).toBe("Tasks — Polychat");
    expect(describeWindowTitle(pageFor("/chat/abc"))).toBe("Chat — Polychat");
  });

  it("falls back to the product name for a path it cannot place", () => {
    expect(describeWindowTitle(undefined)).toBe("Polychat");
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
