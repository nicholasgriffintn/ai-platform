import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  handleMemory: vi.fn(),
  getInstance: vi.fn(),
}));

vi.mock("~/modules/memory/application/manager", () => ({
  MemoryManager: { getInstance: mocks.getInstance },
}));

import { captureRunMemories } from "~/modules/chat/application/agent/memory-capture";

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
    trustedUserInput: true,
    store: true,
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

  it("skips classification when the run already stored a memory itself", async () => {
    const messages = await captureRunMemories(
      createParams({
        toolCalls: [{ id: "call-1", function: { name: "store_memory", arguments: "{}" } }],
      }),
    );

    expect(messages).toEqual([]);
    expect(mocks.handleMemory).not.toHaveBeenCalled();
  });

  it("stays out of the way for users without memory enabled", async () => {
    const messages = await captureRunMemories(createParams({ userSettings: {} }));

    expect(messages).toEqual([]);
    expect(mocks.handleMemory).not.toHaveBeenCalled();
  });

  it("does not persist memory for a temporary run", async () => {
    const messages = await captureRunMemories(createParams({ store: false }));

    expect(messages).toEqual([]);
    expect(mocks.handleMemory).not.toHaveBeenCalled();
  });

  it("does not fail the run when classification throws", async () => {
    mocks.handleMemory.mockRejectedValue(new Error("auxiliary model unavailable"));

    await expect(captureRunMemories(createParams())).resolves.toEqual([]);
  });
  it("classifies against the scope the request resolved", async () => {
    const params = createParams({ memoryScope: { type: "project", projectId: "project-1" } });
    const messages = await captureRunMemories(params);

    expect(mocks.getInstance).toHaveBeenCalledWith(expect.anything(), proUser, expect.anything(), {
      type: "project",
      projectId: "project-1",
    });
    expect(messages).toEqual([
      expect.objectContaining({ role: "tool", name: "memory", status: "success" }),
    ]);
    expect(messages[0].content).toContain("Uses Neovim.");
    expect(params.conversationManager.add).toHaveBeenCalledOnce();
  });
});
