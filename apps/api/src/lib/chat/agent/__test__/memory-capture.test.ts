import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleMemory: vi.fn(),
  getInstance: vi.fn(),
}));

vi.mock("~/lib/memory", () => ({
  MemoryManager: { getInstance: mocks.getInstance },
}));

import { captureRunMemories } from "../memory-capture";

const proUser = { id: 42, plan_id: "pro" };

function createParams(overrides: Record<string, unknown> = {}) {
  const conversationManager = {
    get: vi.fn(async () => [{ role: "user", content: "I use Neovim." }]),
    add: vi.fn(),
  };

  return {
    conversationManager,
    env: { AI: {} },
    completionId: "completion-1",
    context: { user: proUser },
    userSettings: { memories_save_enabled: true },
    memoryScope: { type: "personal" },
    model: "test-model",
    platform: "api",
    toolCalls: [],
    ...overrides,
  } as never as Parameters<typeof captureRunMemories>[0] & {
    conversationManager: typeof conversationManager;
  };
}

describe("captureRunMemories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInstance.mockReturnValue({ handleMemory: mocks.handleMemory });
    mocks.handleMemory.mockResolvedValue([
      { type: "store", category: "preference", text: "Uses Neovim." },
    ]);
  });

  it("records what it stored as a tool message on the conversation", async () => {
    const params = createParams();
    const messages = await captureRunMemories(params);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ role: "tool", name: "memory", status: "success" });
    expect(messages[0].content).toContain("Uses Neovim.");
    expect(params.conversationManager.add).toHaveBeenCalledOnce();
  });

  it("skips classification when the run already stored a memory itself", async () => {
    const messages = await captureRunMemories(
      createParams({
        toolCalls: [{ id: "call-1", function: { name: "store_memory", arguments: "{}" } }],
      }),
    );

    expect(messages).toEqual([]);
    expect(mocks.handleMemory).not.toHaveBeenCalled();
  });

  it("classifies against the scope the request resolved", async () => {
    await captureRunMemories(
      createParams({ memoryScope: { type: "project", projectId: "project-1" } }),
    );

    expect(mocks.getInstance).toHaveBeenCalledWith(expect.anything(), proUser, expect.anything(), {
      type: "project",
      projectId: "project-1",
    });
  });

  it("stays out of the way for users without memory enabled", async () => {
    const messages = await captureRunMemories(createParams({ userSettings: {} }));

    expect(messages).toEqual([]);
    expect(mocks.handleMemory).not.toHaveBeenCalled();
  });

  it("does not fail the run when classification throws", async () => {
    mocks.handleMemory.mockRejectedValue(new Error("auxiliary model unavailable"));

    await expect(captureRunMemories(createParams())).resolves.toEqual([]);
  });
});
