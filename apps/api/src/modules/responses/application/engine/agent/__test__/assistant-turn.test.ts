import { AGENT_HARNESS_PROVIDER } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { CRISIS_SIGNPOST_TEXT } from "~/modules/responses/domain/crisis-signposting";
import { ToolCallType } from "~/types";

import { finaliseAssistantTurn, type FinaliseAssistantTurnParams } from "../assistant-turn";

function finalise(overrides: Partial<FinaliseAssistantTurnParams>) {
  const sink = { write: vi.fn(async () => undefined) };
  const conversationManager = {
    add: vi.fn(async () => undefined),
    releaseTurnReservation: vi.fn(async () => undefined),
  };
  const result = finaliseAssistantTurn({
    turn: { content: "model reply", toolCalls: [] },
    messageId: "message-1",
    sink,
    conversationManager,
    completionId: "conversation-1",
    env: {},
    model: "model",
    provider: AGENT_HARNESS_PROVIDER,
    platform: "web",
    mode: "normal",
    userSettings: { guardrails_enabled: false },
    ...overrides,
  } as unknown as FinaliseAssistantTurnParams);

  return { result, sink };
}

describe("finaliseAssistantTurn crisis signposting", () => {
  it("adds the signpost with guardrails off and tells streaming clients", async () => {
    const { result, sink } = finalise({ crisisSignpost: true });
    const { message } = await result;

    expect(message.content).toBe(`${CRISIS_SIGNPOST_TEXT}\n\nmodel reply`);
    expect(JSON.stringify(sink.write.mock.calls)).toContain(CRISIS_SIGNPOST_TEXT);
  });

  it("keeps the signpost in the stored text part", async () => {
    const { result } = finalise({
      crisisSignpost: true,
      turn: {
        content: "model reply",
        toolCalls: [],
        parts: [{ type: "text", text: "model reply" }],
      },
    });
    const { message } = await result;

    expect(message.parts).toEqual([
      expect.objectContaining({ text: `${CRISIS_SIGNPOST_TEXT}\n\nmodel reply` }),
    ]);
  });

  it("waits for the closing turn when the model is still calling tools", async () => {
    const { result } = finalise({
      crisisSignpost: true,
      turn: {
        content: "checking",
        toolCalls: [
          { id: "call-1", type: ToolCallType.FUNCTION, function: { name: "t", arguments: "{}" } },
        ],
      },
    });
    const { message } = await result;

    expect(message.content).toBe("checking");
  });

  it("leaves other turns alone", async () => {
    const { result } = finalise({});
    const { message } = await result;

    expect(message.content).toBe("model reply");
  });
});
