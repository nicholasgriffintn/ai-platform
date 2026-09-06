import type {
  AssistantActionItem,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getAppBackLink,
  getAppPath,
  getCapabilityOpenPath,
  getEnabledExperiences,
  getProjectSurface,
  PERSONAL_SURFACE,
  type EnabledCapability,
} from "../capability-surfaces";

const notes: ProjectExperienceDefinition = {
  id: "notes",
  runtime: "notes",
  name: "Note Taker",
  description: "Take notes",
  when: "Something is worth keeping.",
  uses: "What you write.",
  produces: "A note you can search.",
  ios: "native",
  scope: "any",
  scopeReason: null,
  requirement: { kind: "capability", capabilityKind: "app", capabilityId: "featured-note-taker" },
};

const savedOutputs: ProjectExperienceDefinition = {
  id: "strudel",
  runtime: "strudel",
  name: "Strudel",
  description: "Music patterns",
  when: "You want a playable pattern.",
  uses: "A description of the sound.",
  produces: "A pattern you can play.",
  ios: "results-only",
  scope: "any",
  scopeReason: null,
  requirement: { kind: "capability_kind", capabilityKind: "app" },
};

function capability(overrides: Partial<EnabledCapability> = {}): EnabledCapability {
  return {
    id: "cap-1",
    kind: "app",
    capabilityId: "featured-note-taker",
    configuration: {},
    createdAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

function teammateItem(availability: "available" | "unavailable"): AssistantActionItem {
  return {
    kind: "teammate",
    capability: { id: "researcher", availability },
    metadata: { teammateId: "researcher" },
  } as unknown as AssistantActionItem;
}

describe("capability surfaces", () => {
  it("builds the same paths for either scope from its base", () => {
    expect(getAppPath(PERSONAL_SURFACE, "notes")).toBe("/chat/apps/notes");
    expect(getAppPath(getProjectSurface("w1", "p1"), "notes")).toBe(
      "/work/w1/projects/p1/apps/notes",
    );
  });

  it("enables an experience from a personal capability with no creator", () => {
    expect(getEnabledExperiences([capability()], [notes])).toEqual([notes]);
  });

  it("keeps a capability-kind experience available whenever any app is enabled", () => {
    expect(getEnabledExperiences([capability()], [savedOutputs])).toEqual([savedOutputs]);
    expect(getEnabledExperiences([], [savedOutputs])).toEqual([]);
  });

  it("returns to the teammates library from the top of an app, not to a separate list", () => {
    expect(getAppBackLink(PERSONAL_SURFACE, "strudel", "", "Strudel")).toEqual({
      to: "/chat/teammates",
      label: "Back to teammates",
    });
    expect(getAppBackLink(getProjectSurface("w1", "p1"), "strudel", "", "Strudel")).toEqual({
      to: "/work/w1/projects/p1/teammates",
      label: "Back to teammates",
    });
  });

  it("steps back one level rather than jumping to the library", () => {
    expect(getAppBackLink(PERSONAL_SURFACE, "strudel", "pattern-1", "Strudel")).toEqual({
      to: "/chat/apps/strudel",
      label: "Back to Strudel",
    });
    expect(getAppBackLink(PERSONAL_SURFACE, "replicate", "predictions/run-1", "Replicate")).toEqual(
      { to: "/chat/apps/replicate/predictions", label: "Back" },
    );
  });

  it("steps back within a project the same way", () => {
    expect(
      getAppBackLink(getProjectSurface("w1", "p1"), "strudel", "pattern-1", "Strudel"),
    ).toEqual({
      to: "/work/w1/projects/p1/apps/strudel",
      label: "Back to Strudel",
    });
  });

  it("routes a runnable tool to the tool runner, and a model tool nowhere", () => {
    const runnable = {
      kind: "tool",
      capability: { id: "get_weather" },
      metadata: { toolId: "get_weather", toolRunnable: true },
    } as unknown as AssistantActionItem;
    const modelTool = {
      kind: "tool",
      capability: { id: "file_search" },
      metadata: { toolId: "file_search" },
    } as unknown as AssistantActionItem;

    expect(getCapabilityOpenPath(runnable, PERSONAL_SURFACE, [])).toBe("/chat/tools/get_weather");
    expect(getCapabilityOpenPath(modelTool, PERSONAL_SURFACE, [])).toBeNull();
  });

  it("starts a conversation with an available teammate in either scope", () => {
    const teammate = teammateItem("available");

    expect(getCapabilityOpenPath(teammate, PERSONAL_SURFACE, [])).toBe("/chat?teammate=researcher");
    expect(getCapabilityOpenPath(teammate, getProjectSurface("w1", "p1"), [])).toBe(
      "/work/w1/projects/p1/chat?teammate=researcher",
    );
  });

  it("offers no way in to a capability the scope cannot run", () => {
    expect(getCapabilityOpenPath(teammateItem("unavailable"), PERSONAL_SURFACE, [])).toBeNull();
  });
});
