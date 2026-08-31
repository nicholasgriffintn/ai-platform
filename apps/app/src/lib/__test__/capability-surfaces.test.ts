import type {
  AssistantActionItem,
  ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import {
  getCapabilityOpenPath,
  getExperienceBackLink,
  getEnabledExperiences,
  getExperiencePath,
  getProjectSurface,
  PERSONAL_SURFACE,
  type EnabledCapability,
} from "../capability-surfaces";

const notes: ProjectExperienceDefinition = {
  id: "notes",
  runtime: "notes",
  name: "Note Taker",
  description: "Take notes",
  requirement: { kind: "capability", capabilityKind: "app", capabilityId: "featured-note-taker" },
};

const savedOutputs: ProjectExperienceDefinition = {
  id: "responses",
  runtime: "responses",
  name: "Saved outputs",
  description: "Review outputs",
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

function agentItem(availability: "available" | "unavailable"): AssistantActionItem {
  return {
    kind: "agent",
    capability: { id: "researcher", availability },
    metadata: { agentId: "researcher" },
  } as unknown as AssistantActionItem;
}

describe("capability surfaces", () => {
  it("builds the same paths for either scope from its base", () => {
    expect(getExperiencePath(PERSONAL_SURFACE, "notes")).toBe("/chat/experiences/notes");
    expect(getExperiencePath(getProjectSurface("w1", "p1"), "notes")).toBe(
      "/work/w1/projects/p1/experiences/notes",
    );
  });

  it("enables an experience from a personal capability with no creator", () => {
    expect(getEnabledExperiences([capability()], [notes])).toEqual([notes]);
  });

  it("keeps a capability-kind experience available whenever any app is enabled", () => {
    expect(getEnabledExperiences([capability()], [savedOutputs])).toEqual([savedOutputs]);
    expect(getEnabledExperiences([], [savedOutputs])).toEqual([]);
  });

  it("steps back one level rather than jumping to the hub", () => {
    expect(getExperienceBackLink(PERSONAL_SURFACE, "strudel", "", "Strudel")).toEqual({
      to: "/chat/experiences",
      label: "Back to experiences",
    });
    expect(getExperienceBackLink(PERSONAL_SURFACE, "strudel", "pattern-1", "Strudel")).toEqual({
      to: "/chat/experiences/strudel",
      label: "Back to Strudel",
    });
    expect(
      getExperienceBackLink(PERSONAL_SURFACE, "replicate", "predictions/run-1", "Replicate"),
    ).toEqual({ to: "/chat/experiences/replicate/predictions", label: "Back" });
  });

  it("steps back within a project the same way", () => {
    expect(
      getExperienceBackLink(
        getProjectSurface("w1", "p1"),
        "responses",
        "output-1",
        "Saved outputs",
      ),
    ).toEqual({
      to: "/work/w1/projects/p1/experiences/responses",
      label: "Back to Saved outputs",
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

  it("starts a conversation with an available agent in either scope", () => {
    const agent = agentItem("available");

    expect(getCapabilityOpenPath(agent, PERSONAL_SURFACE, [])).toBe("/chat?agent=researcher");
    expect(getCapabilityOpenPath(agent, getProjectSurface("w1", "p1"), [])).toBe(
      "/work/w1/projects/p1/chat?agent=researcher",
    );
  });

  it("offers no way in to a capability the scope cannot run", () => {
    expect(getCapabilityOpenPath(agentItem("unavailable"), PERSONAL_SURFACE, [])).toBeNull();
  });
});
