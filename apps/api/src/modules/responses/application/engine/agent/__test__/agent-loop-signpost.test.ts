import { AGENT_HARNESS_PROVIDER, CRISIS_SIGNPOST_TEXT } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAgentLoop } from "../agent-loop";

type AgentLoopParams = Parameters<typeof runAgentLoop>[0];

const mocks = vi.hoisted(() => ({ executeAgentLoop: vi.fn() }));

vi.mock("@ngriffin_uk/polychat-ai-agents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-agents")>()),
  executeAgentLoop: mocks.executeAgentLoop,
}));

function run(overrides: Partial<AgentLoopParams>) {
  return runAgentLoop({
    requestParams: { messages: [{ role: "user", content: "hello" }], store: false },
    completionId: "conversation-1",
    conversationManager: {
      add: vi.fn(async () => undefined),
      get: vi.fn(async () => []),
      getUsageLimits: vi.fn(async () => null),
      releaseTurnReservation: vi.fn(async () => undefined),
    },
    sink: { write: vi.fn(async () => undefined) },
    transport: { streams: false },
    env: {},
    model: "model",
    provider: AGENT_HARNESS_PROVIDER,
    platform: "web",
    mode: "normal",
    userSettings: { guardrails_enabled: false },
    ...overrides,
  } as unknown as AgentLoopParams);
}

describe("runAgentLoop crisis signposting", () => {
  beforeEach(() => {
    mocks.executeAgentLoop.mockReset();
    mocks.executeAgentLoop.mockRejectedValue(new Error("provider down"));
  });

  it("still reaches the person when the model fails", async () => {
    const result = await run({ crisisSignpost: true });

    expect(result.response.response).toContain(CRISIS_SIGNPOST_TEXT);
  });

  it("does not hide the failure on other turns", async () => {
    await expect(run({})).rejects.toThrow("provider down");
  });

  it("lets a cancelled turn stop", async () => {
    mocks.executeAgentLoop.mockRejectedValue(new DOMException("Stopped", "AbortError"));

    await expect(run({ crisisSignpost: true })).rejects.toThrow("Stopped");
  });
});
