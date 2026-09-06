import { META_NAVIGATION_DATA_KEY } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { getFilesTabPath, getProjectFilesPath, parseFilesSubpath } from "../files-route";
import {
  buildMetaAssistantUiContext,
  getMetaNavigationHref,
  readMetaNavigationTarget,
} from "../meta-assistant";
import { getActivePlace } from "../navigation/places";

describe("buildMetaAssistantUiContext", () => {
  it("describes an open project conversation", () => {
    expect(buildMetaAssistantUiContext("/work/w1/projects/p1/chat/c1")).toEqual({
      route: "/work/w1/projects/p1/chat/c1",
      place: "work",
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
      place: "work",
      workspaceId: "w1",
    });
  });

  it("uses the store conversation for the personal chat root and ignores reserved chat segments", () => {
    expect(buildMetaAssistantUiContext("/chat", "c9")).toMatchObject({
      place: "chat",
      conversationId: "c9",
    });
    expect(buildMetaAssistantUiContext("/chat/c2")).toMatchObject({ conversationId: "c2" });
    expect(buildMetaAssistantUiContext("/chat/capabilities").conversationId).toBeUndefined();
    expect(buildMetaAssistantUiContext("/chat/capabilities").place).toBe("library");
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
    expect(getMetaNavigationHref({ kind: "place", place: "attention" })).toBe("/attention");
  });

  it("only reads well-formed navigation data", () => {
    expect(
      readMetaNavigationTarget({ [META_NAVIGATION_DATA_KEY]: { kind: "place", place: "files" } }),
    ).toEqual({ kind: "place", place: "files" });
    expect(readMetaNavigationTarget({ [META_NAVIGATION_DATA_KEY]: { kind: "nope" } })).toBeNull();
    expect(readMetaNavigationTarget(undefined)).toBeNull();
  });
});

describe("places and files routes", () => {
  it("maps paths to rail places", () => {
    expect(getActivePlace("/")).toBe("chat");
    expect(getActivePlace("/chat/abc")).toBe("chat");
    expect(getActivePlace("/chat/agents/a1")).toBe("library");
    expect(getActivePlace("/work/w1/projects/p1/files/made/o1")).toBe("work");
    expect(getActivePlace("/files/given")).toBe("files");
    expect(getActivePlace("/profile")).toBe("you");
  });

  it("parses files subpaths and builds tab paths", () => {
    expect(parseFilesSubpath("")).toEqual({ tab: "made", itemPath: "" });
    expect(parseFilesSubpath("made/output-1")).toEqual({ tab: "made", itemPath: "output-1" });
    expect(parseFilesSubpath("given")).toEqual({ tab: "given", itemPath: "" });
    expect(getFilesTabPath("/files", "made", "/output-1")).toBe("/files/made/output-1");
    expect(getProjectFilesPath("w1", "p1", "given")).toBe("/work/w1/projects/p1/files/given");
  });
});
