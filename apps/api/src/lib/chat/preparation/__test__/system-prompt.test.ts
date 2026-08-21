import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/repositories";
import type { ProjectChatContext } from "~/services/workspaces/chatContext";
import type { CoreChatOptions, Message } from "~/types";

import { buildSystemPrompt } from "../system-prompt";

const mocks = vi.hoisted(() => ({
  getSystemPrompt: vi.fn(),
  buildGoalContractSection: vi.fn(),
}));

vi.mock("~/lib/prompts", () => ({ getSystemPrompt: mocks.getSystemPrompt }));
vi.mock("~/lib/prompts/sections/goal", () => ({
  buildGoalContractSection: mocks.buildGoalContractSection,
}));

function createRepositories(synthesisText?: string) {
  return {
    memorySyntheses: {
      getActiveSynthesis: vi
        .fn()
        .mockResolvedValue(synthesisText ? { synthesis_text: synthesisText } : null),
    },
  } as unknown as RepositoryManager;
}

function baseParams(overrides: Record<string, any> = {}) {
  return {
    options: {
      env: {} as any,
      mode: "normal",
      context: { user: { id: 1, plan_id: "pro" } },
    } as unknown as CoreChatOptions,
    repositories: createRepositories(),
    sanitisedMessages: [] as Message[],
    finalMessage: "what is the weather",
    primaryModel: "test-model",
    userSettings: {},
    memoryPolicy: { enabled: false } as any,
    projectContext: null as ProjectChatContext | null,
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSystemPrompt.mockResolvedValue("generated prompt");
    mocks.buildGoalContractSection.mockReturnValue("GOAL CONTRACT");
  });

  it("prefers an explicit request prompt over generating one", async () => {
    const result = await buildSystemPrompt(
      baseParams({ options: { ...baseParams().options, system_prompt: "explicit" } }) as any,
    );

    expect(result).toBe("explicit");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });

  it("falls back to a system turn already in the conversation", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        sanitisedMessages: [{ role: "system", content: "from history" }] as Message[],
      }) as any,
    );

    expect(result).toBe("from history");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });

  it("generates a prompt when neither is supplied", async () => {
    const result = await buildSystemPrompt(baseParams() as any);

    expect(result).toBe("generated prompt");
    expect(mocks.getSystemPrompt).toHaveBeenCalledTimes(1);
  });

  it("returns only appended sections for no_system mode", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        options: { ...baseParams().options, mode: "no_system" },
        projectContext: { instructions: "be terse" } as ProjectChatContext,
      }) as any,
    );

    expect(result).toBe("Project instructions:\nbe terse");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });

  it("appends project instructions and an active goal contract", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        projectContext: { instructions: "be terse" } as ProjectChatContext,
        activeGoal: { status: "active" } as any,
      }) as any,
    );

    expect(result).toBe("generated prompt\n\nProject instructions:\nbe terse\n\nGOAL CONTRACT");
  });

  it("ignores a goal that is no longer active", async () => {
    const result = await buildSystemPrompt(
      baseParams({ activeGoal: { status: "completed" } as any }) as any,
    );

    expect(result).toBe("generated prompt");
    expect(mocks.buildGoalContractSection).not.toHaveBeenCalled();
  });

  it("appends personal memory context when memory is enabled", async () => {
    const repositories = createRepositories("remembered things");
    const result = await buildSystemPrompt(
      baseParams({ repositories, memoryPolicy: { enabled: true } as any }) as any,
    );

    expect(result).toContain("generated prompt");
    expect(result).toContain("remembered things");
  });

  it("does not read memory synthesis for a project-scoped turn", async () => {
    const repositories = createRepositories("remembered things");

    await buildSystemPrompt(
      baseParams({
        repositories,
        memoryPolicy: { enabled: true } as any,
        memoryScope: { type: "project", projectId: "p1" },
      }) as any,
    );

    expect(repositories.memorySyntheses.getActiveSynthesis).not.toHaveBeenCalled();
  });

  it("keeps the prompt when the memory read fails", async () => {
    const repositories = createRepositories("remembered things");

    vi.mocked(repositories.memorySyntheses.getActiveSynthesis).mockRejectedValue(
      new Error("d1 unavailable"),
    );

    const result = await buildSystemPrompt(
      baseParams({ repositories, memoryPolicy: { enabled: true } as any }) as any,
    );

    expect(result).toBe("generated prompt");
  });
});
