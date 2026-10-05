import { POLY_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getFilesTabPath, getProjectFilesPath, parseFilesSubpath } from "../files-route.js";
import { getActivePlace } from "../navigation/places.js";
import { buildPolyUiContext, getPolyNavigationHref, readPolyNavigationTarget } from "../poly.js";

describe("buildPolyUiContext", () => {
  it("describes an open project conversation", () => {
    expect(buildPolyUiContext("/work/w1/projects/p1/chat/c1")).toEqual({
      route: "/work/w1/projects/p1/chat/c1",
      mode: "work",
      place: "conversations",
      workspaceId: "w1",
      projectId: "p1",
      conversationId: "c1",
    });
  });

  it("describes a project task and a bare workspace", () => {
    expect(buildPolyUiContext("/work/w1/projects/p1/tasks/t1")).toMatchObject({
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
    });
    expect(buildPolyUiContext("/work/w1/members")).toEqual({
      route: "/work/w1/members",
      mode: "work",
      place: "conversations",
      workspaceId: "w1",
    });
  });

  it("uses the store conversation for the personal chat root and ignores reserved chat segments", () => {
    expect(buildPolyUiContext("/chat", "c9")).toMatchObject({
      mode: "chat",
      place: "conversations",
      conversationId: "c9",
    });
    expect(buildPolyUiContext("/chat/c2")).toMatchObject({ conversationId: "c2" });
    expect(buildPolyUiContext("/chat/teammates").conversationId).toBeUndefined();
    expect(buildPolyUiContext("/chat/teammates").place).toBe("teammates");
    expect(buildPolyUiContext("/chat/scheduled").conversationId).toBeUndefined();
    expect(buildPolyUiContext("/chat/scheduled").place).toBe("scheduled");
  });
});

describe("meta navigation", () => {
  it("opens Work Canvas, Files, Teammates, Plugins and Scheduled under their authorised project", () => {
    for (const place of ["canvas", "files", "teammates", "plugins", "scheduled"] as const) {
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
  it("resolves every target kind to a host path", () => {
    expect(
      getPolyNavigationHref({
        kind: "conversation",
        conversationId: "c1",
        workspaceId: "w1",
        projectId: "p1",
      }),
    ).toBe("/work/w1/projects/p1/chat/c1");
    expect(getPolyNavigationHref({ kind: "conversation", conversationId: "c1" })).toBe("/chat/c1");
    expect(getPolyNavigationHref({ kind: "project", workspaceId: "w1", projectId: "p1" })).toBe(
      "/work/w1/projects/p1",
    );
    expect(getPolyNavigationHref({ kind: "place", place: "attention", mode: "chat" })).toBe(
      "/chat/attention",
    );
    expect(getPolyNavigationHref({ kind: "place", place: "attention", mode: "work" })).toBe(
      "/work/attention",
    );
    expect(getPolyNavigationHref({ kind: "place", place: "you", mode: "chat" })).toBe("/profile");
  });

  it("only reads well-formed navigation data", () => {
    expect(
      readPolyNavigationTarget({ [POLY_NAVIGATION_DATA_KEY]: { kind: "place", place: "files" } }),
    ).toEqual({ kind: "place", place: "files", mode: "chat" });
    expect(readPolyNavigationTarget({ [POLY_NAVIGATION_DATA_KEY]: { kind: "nope" } })).toBeNull();
    expect(readPolyNavigationTarget(undefined)).toBeNull();
  });
});

describe("places and files routes", () => {
  it("reads the place from the path, whichever mode it is in", () => {
    expect(getActivePlace("/")).toBe("conversations");
    expect(getActivePlace("/chat/abc")).toBe("conversations");
    expect(getActivePlace("/chat/teammates/a1")).toBe("teammates");
    expect(getActivePlace("/chat/apps/strudel")).toBe("plugins");
    expect(getActivePlace("/chat/apps/sites")).toBe("sites");
    expect(getActivePlace("/chat/tools/get-weather")).toBe("plugins");
    expect(getActivePlace("/chat/skills/research")).toBe("plugins");
    expect(getActivePlace("/chat/canvas")).toBe("canvas");
    expect(getActivePlace("/chat/files/given")).toBe("files");
    expect(getActivePlace("/chat/plugins")).toBe("plugins");
    expect(getActivePlace("/chat/scheduled")).toBe("scheduled");
    expect(getActivePlace("/chat/attention")).toBe("attention");
    expect(getActivePlace("/work")).toBe("conversations");
    expect(getActivePlace("/work/attention")).toBe("attention");
    expect(getActivePlace("/work/w1/projects/p1/canvas")).toBe("canvas");
    expect(getActivePlace("/work/w1/projects/p1/files/made/o1")).toBe("files");
    expect(getActivePlace("/work/w1/projects/p1/teammates")).toBe("teammates");
    expect(getActivePlace("/work/w1/projects/p1/scheduled")).toBe("scheduled");
    expect(getActivePlace("/work/w1/projects/p1/plugins")).toBe("plugins");
    expect(getActivePlace("/work/w1/projects/p1/apps/sites/site-1")).toBe("sites");
    expect(getActivePlace("/work/w1/projects/p1/apps/notes")).toBe("plugins");
    expect(getActivePlace("/profile")).toBe("you");
    expect(getActivePlace("/pricing")).toBeUndefined();
  });

  it("parses files subpaths and builds tab paths", () => {
    expect(parseFilesSubpath("")).toEqual({ tab: "made", itemPath: "" });
    expect(parseFilesSubpath("made/output-1")).toEqual({ tab: "made", itemPath: "output-1" });
    expect(parseFilesSubpath("given")).toEqual({ tab: "given", itemPath: "" });
    expect(getFilesTabPath("/chat/files", "made", "/output-1")).toBe("/chat/files/made/output-1");
    expect(getProjectFilesPath("w1", "p1", "given")).toBe("/work/w1/projects/p1/files/given");
  });
});
