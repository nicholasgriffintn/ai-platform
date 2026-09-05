import { beforeEach, describe, expect, it, vi } from "vitest";

import { ResponseFormatter } from "~/lib/formatter/responses";
import type { ChatCompletionParameters, IEnv } from "~/types";
import { resolveEffectiveMaxTokens } from "~/utils/parameters";

import { extractPanelRouting, runPanel, type PanelMember } from "../panel";

const mocks = vi.hoisted(() => ({
  getAIResponse: vi.fn(),
  recordModelTurnUsage: vi.fn(async (_params: { messageId?: string }) => undefined),
}));

vi.mock("~/lib/chat/streaming/responses", () => ({ getAIResponse: mocks.getAIResponse }));
vi.mock("~/lib/usage/modelUsage", () => ({
  recordModelTurnUsage: mocks.recordModelTurnUsage,
}));
vi.mock("~/lib/context/serviceContext", () => ({ createServiceContext: () => ({}) }));
vi.mock("~/lib/providers/models", () => ({
  getAuxiliaryModel: vi.fn(async () => ({ model: "auxiliary-model", provider: "auxiliary" })),
}));

const MEMBERS: PanelMember[] = [
  { id: "chair", name: "Chair", role: "facilitator", instruction: "Facilitate." },
  { id: "sceptic", name: "Sceptic", role: "assumption tester", instruction: "Challenge." },
];

function routingTag(payload: Record<string, unknown>): string {
  return `<panel_next>${JSON.stringify(payload)}</panel_next>`;
}

function baseParams() {
  const env: IEnv = Object.create(null);

  return {
    env,
    completionId: "conversation-1",
    usageScopeId: "tool-call-1",
    runId: "run-1",
    runAttempt: 2,
    question: "Should we migrate?",
    members: MEMBERS,
    turnBrief: "Turn brief.",
    conclusionBrief: "Conclusion brief.",
  };
}

describe("extractPanelRouting", () => {
  const memberIds = new Set(["chair", "sceptic"]);

  it("strips the routing tag from what the user sees", () => {
    const result = extractPanelRouting(
      `Real content.\n${routingTag({ shouldContinue: true, nextMemberIds: ["sceptic"] })}`,
      memberIds,
    );

    expect(result.content).toBe("Real content.");
    expect(result.routing).toMatchObject({ shouldContinue: true, nextMemberIds: ["sceptic"] });
  });

  it("drops member ids outside the convened panel", () => {
    const result = extractPanelRouting(
      `Content.${routingTag({ shouldContinue: true, nextMemberIds: ["joker", "sceptic"] })}`,
      memberIds,
    );

    expect(result.routing?.nextMemberIds).toEqual(["sceptic"]);
  });

  it("ends the panel when the tag is missing or unparseable", () => {
    expect(extractPanelRouting("Content with no tag.", memberIds).routing).toBeNull();
    expect(
      extractPanelRouting("Content.<panel_next>not json</panel_next>", memberIds).routing,
    ).toBeNull();
  });
});

describe("runPanel", () => {
  beforeEach(() => {
    mocks.getAIResponse.mockReset();
    mocks.recordModelTurnUsage.mockClear();
  });

  it("routes between members, streams each turn, and uses the caller's model", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce({
        response: `Chair opens.\n${routingTag({ shouldContinue: true, nextMemberIds: ["sceptic"] })}`,
      })
      .mockResolvedValueOnce({
        response: `Sceptic objects.\n${routingTag({ shouldContinue: false, nextMemberIds: [] })}`,
      })
      .mockResolvedValueOnce({ response: "The chamber decides." });

    const streamed: string[] = [];
    const result = await runPanel({
      ...baseParams(),
      model: "user-selected-model",
      provider: "user-provider",
      onTurn: (turn) => {
        streamed.push(`${turn.memberName}:${turn.turn}`);
      },
    });

    expect(streamed).toEqual(["Chair:1", "Sceptic:2"]);
    expect(result.turns.map((turn) => turn.content)).toEqual(["Chair opens.", "Sceptic objects."]);
    expect(result.conclusion).toBe("The chamber decides.");
    expect(result.stoppedReason).toBe("consensus");
    expect(result.model).toBe("user-selected-model");
    expect(
      mocks.getAIResponse.mock.calls.every(([payload]) => payload.model === "user-selected-model"),
    ).toBe(true);
    expect(mocks.recordModelTurnUsage).toHaveBeenCalledTimes(3);
    expect(mocks.recordModelTurnUsage.mock.calls.map(([call]) => call.messageId)).toEqual([
      "panel:tool-call-1:0",
      "panel:tool-call-1:1",
      "panel:tool-call-1:2",
    ]);
    expect(mocks.recordModelTurnUsage).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "run-1", runAttempt: 2 }),
    );
  });

  it("stops at the turn budget when members keep routing onward", async () => {
    mocks.getAIResponse.mockResolvedValue({
      response: `Still going.\n${routingTag({ shouldContinue: true, nextMemberIds: ["sceptic"] })}`,
    });

    const result = await runPanel({ ...baseParams(), model: "m", maxTurns: 3 });

    expect(result.turns).toHaveLength(3);
    expect(result.stoppedReason).toBe("turn_budget");
  });

  it("falls back to the auxiliary model only when no model is supplied", async () => {
    mocks.getAIResponse.mockResolvedValue({ response: "Turn with no routing tag." });

    const result = await runPanel(baseParams());

    expect(result.model).toBe("auxiliary-model");
    expect(result.turns).toHaveLength(1);
  });

  it("continues the debate when one member's completion fails", async () => {
    mocks.getAIResponse
      .mockResolvedValueOnce({
        response: `Chair opens.\n${routingTag({ shouldContinue: true, nextMemberIds: ["sceptic"] })}`,
      })
      .mockRejectedValueOnce(new Error("provider exploded"))
      .mockResolvedValueOnce({ response: "Conclusion despite the gap." });

    const result = await runPanel({ ...baseParams(), model: "m" });

    expect(result.turns).toHaveLength(1);
    expect(result.conclusion).toBe("Conclusion despite the gap.");
  });

  it("leaves room for reasoning before a member's answer and conclusion", async () => {
    mocks.getAIResponse.mockImplementation(async (payload: ChatCompletionParameters) => {
      const maxTokens = resolveEffectiveMaxTokens(payload, undefined);
      const exhausted = maxTokens !== undefined && maxTokens <= 900;

      return ResponseFormatter.formatResponse(
        {
          choices: [
            {
              message: {
                content: exhausted ? "" : "A considered answer.",
                reasoning_content: "Consider the competing perspectives.",
              },
              finish_reason: exhausted ? "length" : "stop",
            },
          ],
          usage: { prompt_tokens: 482, completion_tokens: exhausted ? 900 : 1200 },
        },
        "workers-ai",
      );
    });

    const result = await runPanel({
      ...baseParams(),
      model: "@cf/zai-org/glm-4.7-flash",
      provider: "workers-ai",
    });

    expect(result.turns[0].content).toBe("A considered answer.");
    expect(result.conclusion).toBe("A considered answer.");
    expect(mocks.recordModelTurnUsage).toHaveBeenCalledTimes(2);
  });

  it("tries another member when the opening completion fails", async () => {
    mocks.getAIResponse
      .mockRejectedValueOnce(new Error("Opening completion failed"))
      .mockResolvedValueOnce({ response: "Sceptic opens instead." })
      .mockResolvedValueOnce({ response: "The panel decides." });

    const result = await runPanel({ ...baseParams(), model: "m" });

    expect(result.turns).toMatchObject([
      { memberId: "sceptic", content: "Sceptic opens instead." },
    ]);
    expect(result.conclusion).toBe("The panel decides.");
  });

  it("preserves the failure after every member has been attempted", async () => {
    const error = new Error("Provider unavailable");

    mocks.getAIResponse.mockRejectedValue(error);

    await expect(runPanel({ ...baseParams(), model: "m" })).rejects.toBe(error);
    expect(mocks.getAIResponse).toHaveBeenCalledTimes(2);
  });

  it("counts failed attempts towards the panel's turn budget", async () => {
    const error = new Error("Provider unavailable");

    mocks.getAIResponse.mockRejectedValue(error);

    await expect(runPanel({ ...baseParams(), model: "m", maxTurns: 1 })).rejects.toBe(error);
    expect(mocks.getAIResponse).toHaveBeenCalledTimes(1);
  });
});
