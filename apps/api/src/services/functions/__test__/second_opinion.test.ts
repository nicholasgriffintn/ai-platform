import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runPanel: vi.fn(),
  findModelConfig: vi.fn(),
}));

vi.mock("~/lib/chat/panel", () => ({ runPanel: mocks.runPanel }));
vi.mock("~/lib/providers/models", () => ({ findModelConfig: mocks.findModelConfig }));

import { second_opinion } from "../second_opinion";

function createContext(messages: unknown[] = []) {
  return {
    completionId: "completion-1",
    env: { AI: {} },
    conversationManager: { get: vi.fn(async () => messages) },
    request: { env: { AI: {} }, request: { model: "primary-model" } },
    emitToolResult: vi.fn(),
  } as never;
}

describe("second_opinion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findModelConfig.mockImplementation(async (modelId: string) => ({
      matchingModel: modelId,
      provider: `${modelId}-provider`,
      name: modelId.toUpperCase(),
    }));
    mocks.runPanel.mockResolvedValue({
      turns: [],
      conclusion: "Trust the original answer.",
      model: "primary-model",
      stoppedReason: "consensus",
    });
  });

  it("reviews the last assistant answer in the conversation", async () => {
    const context = createContext([
      { role: "user", content: "Is this safe?" },
      { role: "assistant", content: "Yes, entirely." },
    ]);

    await second_opinion.execute({ models: ["reviewer-a", "reviewer-b"] }, context);

    const question = mocks.runPanel.mock.calls[0][0].question;

    expect(question).toContain("Is this safe?");
    expect(question).toContain("Yes, entirely.");
  });

  it("gives each reviewer its own model so agreement means something", async () => {
    await second_opinion.execute(
      { models: ["reviewer-a", "reviewer-b"] },
      createContext([{ role: "assistant", content: "An answer." }]),
    );

    expect(mocks.runPanel.mock.calls[0][0].members).toEqual([
      expect.objectContaining({ model: "reviewer-a", provider: "reviewer-a-provider" }),
      expect.objectContaining({ model: "reviewer-b", provider: "reviewer-b-provider" }),
    ]);
  });

  it("refuses when there is nothing in the conversation to review", async () => {
    const result = await second_opinion.execute({ models: ["reviewer-a"] }, createContext([]));

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.runPanel).not.toHaveBeenCalled();
  });

  it("refuses when none of the requested models resolve", async () => {
    mocks.findModelConfig.mockResolvedValue(null);

    const result = await second_opinion.execute({ models: ["missing"] }, createContext([]));

    expect(result).toMatchObject({ status: "error" });
    expect(mocks.runPanel).not.toHaveBeenCalled();
  });

  it("reviews supplied text instead of the thread when the caller passes it", async () => {
    await second_opinion.execute(
      { models: ["reviewer-a"], answer: "Pasted from elsewhere." },
      createContext([{ role: "assistant", content: "Not this one." }]),
    );

    const question = mocks.runPanel.mock.calls[0][0].question;

    expect(question).toContain("Pasted from elsewhere.");
    expect(question).not.toContain("Not this one.");
  });
});
