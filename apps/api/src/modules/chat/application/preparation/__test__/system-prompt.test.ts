import { estimateTextTokens } from "@ngriffin_uk/polychat-ai-providers";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  buildSystemPrompt,
  projectRunMemory,
} from "~/modules/chat/application/preparation/system-prompt";
import type { ProjectChatContext } from "~/modules/workspaces/application/chatContext";
import type { CoreChatOptions, Message } from "~/types";

import { memoryDocumentFixture } from "../../../../../../test/fixtures/native-memory";

const mocks = vi.hoisted(() => ({
  getSystemPrompt: vi.fn(),
  buildGoalContractSection: vi.fn(),
}));

vi.mock("~/modules/chat/application/prompts", () => ({ getSystemPrompt: mocks.getSystemPrompt }));
vi.mock("@ngriffin_uk/polychat-ai-prompts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@ngriffin_uk/polychat-ai-prompts")>();

  return { ...actual, buildGoalContractSection: mocks.buildGoalContractSection };
});

function createRepositories(synthesisText?: string) {
  return {
    memorySyntheses: {
      getActiveSynthesis: vi
        .fn()
        .mockResolvedValue(synthesisText ? { synthesis_text: synthesisText } : null),
    },
    teammateContexts: { getByIdentity: vi.fn().mockResolvedValue(null) },
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

  it.each([undefined, "Old Chat instructions"])(
    "refreshes Poly's current place despite a retained system prompt: %s",
    async (systemPrompt) => {
      const poly = {
        ui_context: { mode: "work", projectId: "project-1", route: "/work/w1/projects/project-1" },
      };
      const result = await buildSystemPrompt(
        baseParams({
          options: {
            ...baseParams().options,
            system_prompt: systemPrompt,
            poly: poly,
          },
          sanitisedMessages: [{ role: "system", content: "<mode>Chat</mode>" }],
        }),
      );

      expect(result).toBe("generated prompt");
      expect(mocks.getSystemPrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          request: expect.objectContaining({ poly: poly }),
        }),
      );
    },
  );

  it("returns only appended sections for no_system mode", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        options: { ...baseParams().options, mode: "no_system" },
        projectContext: { instructions: "be terse" } as ProjectChatContext,
      }),
    );

    expect(result).toBe("Project instructions:\nbe terse");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });

  it("appends project instructions and an active goal contract", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        projectContext: { instructions: "be terse" } as ProjectChatContext,
        activeGoal: { status: "active" } as any,
      }),
    );

    expect(result).toBe("generated prompt\n\nProject instructions:\nbe terse\n\nGOAL CONTRACT");
  });

  it("ignores a goal that is no longer active", async () => {
    const result = await buildSystemPrompt(
      baseParams({ activeGoal: { status: "completed" } as any }),
    );

    expect(result).toBe("generated prompt");
    expect(mocks.buildGoalContractSection).not.toHaveBeenCalled();
  });

  it("does not read memory synthesis for a project-scoped turn", async () => {
    const repositories = createRepositories("remembered things");

    await buildSystemPrompt(
      baseParams({
        repositories,
        memoryPolicy: { enabled: true } as any,
        memoryScope: { type: "project", projectId: "p1" },
      }),
    );

    expect(repositories.memorySyntheses.getActiveSynthesis).not.toHaveBeenCalled();
  });

  it("keeps the prompt when the memory read fails", async () => {
    const repositories = createRepositories("remembered things");

    vi.mocked(repositories.memorySyntheses.getActiveSynthesis).mockRejectedValue(
      new Error("d1 unavailable"),
    );

    const result = await buildSystemPrompt(
      baseParams({ repositories, memoryPolicy: { enabled: true } as any }),
    );

    expect(result).toBe("generated prompt");
  });
  it("prefers an explicit request prompt over generating one", async () => {
    const result = await buildSystemPrompt(
      baseParams({ options: { ...baseParams().options, system_prompt: "explicit" } }),
    );

    expect(result).toBe("explicit");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });

  it("falls back to a system turn already in the conversation", async () => {
    const result = await buildSystemPrompt(
      baseParams({
        sanitisedMessages: [{ role: "system", content: "from history" }] as Message[],
      }),
    );

    expect(result).toBe("from history");
    expect(mocks.getSystemPrompt).not.toHaveBeenCalled();
  });
});

describe("bounded run memory", () => {
  it("includes working notes and exposes references without loading their complete bodies", () => {
    const working = memoryDocumentFixture({ kind: "teammate_context" });
    const reference = memoryDocumentFixture({
      id: "reference",
      name: "research",
      content: "Private research body ".repeat(1000),
    });
    const result = projectRunMemory(
      [
        { document: reference, access: "read" },
        { document: working, access: "read-write" },
      ],
      16000,
      "",
    );

    expect(result.section).toContain(working.content);
    expect(result.section).toContain('"documentId":"reference"');
    expect(result.section).not.toContain(reference.content);
    expect(estimateTextTokens(result.section)).toBeLessThanOrEqual(2400);
  });

  it("keeps oversized working notes intact for paging and leaves room for the existing prompt", () => {
    const oversized = memoryDocumentFixture({
      kind: "conversation_brief",
      content: "Important decision ".repeat(5000),
    });
    const documents = [{ document: oversized, access: "read" as const }];
    const result = projectRunMemory(documents, 4000, "");

    expect(result.section).toContain('"documentId":"memory"');
    expect(result.section).not.toContain(oversized.content);
    expect(estimateTextTokens(result.section)).toBeLessThanOrEqual(600);
    expect(projectRunMemory(documents, 4000, "Existing instructions ".repeat(3000)).section).toBe(
      "",
    );
  });
});
