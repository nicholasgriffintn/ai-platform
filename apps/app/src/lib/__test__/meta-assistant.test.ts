import { META_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getFilesTabPath, getProjectFilesPath, parseFilesSubpath } from "../files-route";
import {
  buildMetaAssistantUiContext,
  getMetaNavigationHref,
  readMetaNavigationTarget,
} from "../meta-assistant";
import { getActivePlace, getPlacePaths, getProductMode } from "../navigation/places";

describe("buildMetaAssistantUiContext", () => {
  it("describes an open project conversation", () => {
    expect(buildMetaAssistantUiContext("/work/w1/projects/p1/chat/c1")).toEqual({
      route: "/work/w1/projects/p1/chat/c1",
      mode: "work",
      place: "conversations",
      workspaceId: "w1",
      projectId: "p1",
      conversationId: "c1",
    });
  });

  it("describes a project task and a bare workspace", () => {
    expect(buildMetaAssistantUiContext("/work/w1/projects/p1/tasks/t1")).toMatchObject({
      workspaceId: "w1",
      projectId: "p1",
      taskId: "t1",
    });
    expect(buildMetaAssistantUiContext("/work/w1/members")).toEqual({
      route: "/work/w1/members",
      mode: "work",
      place: "conversations",
      workspaceId: "w1",
    });
  });

  it("uses the store conversation for the personal chat root and ignores reserved chat segments", () => {
    expect(buildMetaAssistantUiContext("/chat", "c9")).toMatchObject({
      mode: "chat",
      place: "conversations",
      conversationId: "c9",
    });
    expect(buildMetaAssistantUiContext("/chat/c2")).toMatchObject({ conversationId: "c2" });
    expect(buildMetaAssistantUiContext("/chat/teammates").conversationId).toBeUndefined();
    expect(buildMetaAssistantUiContext("/chat/teammates").place).toBe("teammates");
  });
});

describe("meta navigation", () => {
  it("resolves every target kind to a host path", () => {
    expect(
      getMetaNavigationHref({
        kind: "conversation",
        conversationId: "c1",
        workspaceId: "w1",
        projectId: "p1",
      }),
    ).toBe("/work/w1/projects/p1/chat/c1");
    expect(getMetaNavigationHref({ kind: "conversation", conversationId: "c1" })).toBe("/chat/c1");
    expect(getMetaNavigationHref({ kind: "project", workspaceId: "w1", projectId: "p1" })).toBe(
      "/work/w1/projects/p1",
    );
    expect(getMetaNavigationHref({ kind: "place", place: "attention", mode: "chat" })).toBe(
      "/chat/attention",
    );
    expect(getMetaNavigationHref({ kind: "place", place: "attention", mode: "work" })).toBe(
      "/work/attention",
    );
    expect(getMetaNavigationHref({ kind: "place", place: "you", mode: "chat" })).toBe("/profile");
  });

  it("only reads well-formed navigation data", () => {
    expect(
      readMetaNavigationTarget({ [META_NAVIGATION_DATA_KEY]: { kind: "place", place: "files" } }),
    ).toEqual({ kind: "place", place: "files", mode: "chat" });
    expect(readMetaNavigationTarget({ [META_NAVIGATION_DATA_KEY]: { kind: "nope" } })).toBeNull();
    expect(readMetaNavigationTarget(undefined)).toBeNull();
  });
});

describe("places and files routes", () => {
  it("reads the place from the path, whichever mode it is in", () => {
    expect(getActivePlace("/")).toBe("conversations");
    expect(getActivePlace("/chat/abc")).toBe("conversations");
    expect(getActivePlace("/chat/teammates/a1")).toBe("teammates");
    expect(getActivePlace("/chat/apps/strudel")).toBe("teammates");
    expect(getActivePlace("/chat/files/given")).toBe("files");
    expect(getActivePlace("/chat/attention")).toBe("attention");
    expect(getActivePlace("/work")).toBe("conversations");
    expect(getActivePlace("/work/attention")).toBe("attention");
    expect(getActivePlace("/work/w1/projects/p1/files/made/o1")).toBe("files");
    expect(getActivePlace("/work/w1/projects/p1/teammates")).toBe("teammates");
    expect(getActivePlace("/profile")).toBe("you");
    expect(getActivePlace("/pricing")).toBeUndefined();
  });

  it("reads the mode from the path so a place keeps its context", () => {
    expect(getProductMode("/chat/files/made")).toBe("chat");
    expect(getProductMode("/work/w1/projects/p1/files/made")).toBe("work");
    expect(getPlacePaths("chat").files).toBe("/chat/files");
    expect(getPlacePaths("work").attention).toBe("/work/attention");
  });

  it("parses files subpaths and builds tab paths", () => {
    expect(parseFilesSubpath("")).toEqual({ tab: "made", itemPath: "" });
    expect(parseFilesSubpath("made/output-1")).toEqual({ tab: "made", itemPath: "output-1" });
    expect(parseFilesSubpath("given")).toEqual({ tab: "given", itemPath: "" });
    expect(getFilesTabPath("/chat/files", "made", "/output-1")).toBe("/chat/files/made/output-1");
    expect(getProjectFilesPath("w1", "p1", "given")).toBe("/work/w1/projects/p1/files/given");
  });
});
