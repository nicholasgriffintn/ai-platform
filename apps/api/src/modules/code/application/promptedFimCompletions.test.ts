import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { AuthorisedModelTarget } from "~/modules/responses/application/engine/streaming/responses";

import {
  createPromptedFimCompletion,
  readPromptedFimText,
  resolvePromptedFimTokenBudget,
} from "./promptedFimCompletions";

const mocks = vi.hoisted(() => ({
  admitTurn: vi.fn(),
  isByokTurn: vi.fn(),
  recordModelTurnUsage: vi.fn(),
  getAIResponseForTarget: vi.fn(),
  release: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-billing")>()),
  admitTurn: mocks.admitTurn,
  isByokTurn: mocks.isByokTurn,
  recordModelTurnUsage: mocks.recordModelTurnUsage,
}));

vi.mock("~/modules/responses/application/engine/streaming/responses", () => ({
  getAIResponseForTarget: mocks.getAIResponseForTarget,
}));

vi.mock("~/modules/usage/application/runtime", () => ({
  createUsageRuntime: () => ({ store: {} }),
}));

const context = {
  env: {},
  repositories: {},
  requireUser: () => ({ id: 1, plan_id: "free" }),
} as unknown as ServiceContext;
const target = {
  config: { provider: "deepseek", matchingModel: "deepseek-v4-pro" },
  credentialAuthority: "platform",
} as unknown as AuthorisedModelTarget;

describe("readPromptedFimText", () => {
  it("removes an enclosing code fence and keeps meaningful whitespace otherwise", () => {
    expect(readPromptedFimText("```ts\n  return a + b;\n```\n")).toBe("  return a + b;");
    expect(readPromptedFimText("  return a + b;\n")).toBe("  return a + b;\n");
  });

  it("cuts the text at the earliest stop sequence", () => {
    expect(readPromptedFimText("one\ntwo;three", [";", "\n"])).toBe("one");
  });
});

describe("resolvePromptedFimTokenBudget", () => {
  const model = { provider: "workers-ai", matchingModel: "model" };

  it("keeps thinking out of the requested budget when reasoning cannot be switched off", () => {
    expect(
      resolvePromptedFimTokenBudget({ ...model, strengths: ["reasoning", "coding"] }, 100),
    ).toBeGreaterThan(1000);
  });

  it("holds other models to the requested budget", () => {
    expect(resolvePromptedFimTokenBudget({ ...model, strengths: ["coding"] }, 100)).toBe(100);
    expect(
      resolvePromptedFimTokenBudget(
        {
          ...model,
          strengths: ["reasoning"],
          reasoningConfig: { supportedEffortLevels: ["none", "high"] },
        },
        100,
      ),
    ).toBe(100);
  });
});

describe("createPromptedFimCompletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isByokTurn.mockResolvedValue(false);
    mocks.admitTurn.mockResolvedValue({
      admitted: true,
      reservation: { release: mocks.release },
    });
    mocks.getAIResponseForTarget.mockResolvedValue({
      response: "return a + b;",
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });

  it("does not call the model once the credit balance is spent", async () => {
    mocks.admitTurn.mockResolvedValue({ admitted: false });

    await expect(
      createPromptedFimCompletion({ context, target, prompt: "function add(a, b) {" }),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(mocks.getAIResponseForTarget).not.toHaveBeenCalled();
  });

  it("charges the turn and returns the text completion shape", async () => {
    const completion = await createPromptedFimCompletion({
      context,
      target,
      prompt: "function add(a, b) {",
      suffix: "}",
    });

    expect(completion).toMatchObject({
      object: "text_completion",
      model: "deepseek-v4-pro",
      choices: [{ text: "return a + b;", index: 0, finish_reason: "stop" }],
    });
    expect(mocks.recordModelTurnUsage).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
  });

  it("sends a streamed request as one completion event and a done marker", async () => {
    const stream = await createPromptedFimCompletion({
      context,
      target,
      prompt: "function add(a, b) {",
      stream: true,
    });
    const body = await new Response(stream as ReadableStream).text();

    expect(body).toContain('"text":"return a + b;"');
    expect(body.endsWith("data: [DONE]\n\n")).toBe(true);
  });
});
