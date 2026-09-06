import type { ChatRun } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import type { ChatRunUsageEventSummaryRow } from "~/repositories/UsageEventRepository";

import { buildChatRunUsage } from "../usage";

const run: ChatRun = {
  protocolVersion: 1,
  id: "run-1",
  conversationId: "conversation-1",
  projectId: null,
  projectTaskId: null,
  initiatorUserId: 1,
  status: "running",
  attempt: 2,
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:05:00.000Z",
  startedAt: null,
  completedAt: null,
  terminalReason: null,
  lastMessageId: null,
  context: {
    protocolVersion: 1,
    runId: "run-1",
    conversationId: "conversation-1",
    attempt: 2,
    step: 1,
    model: "model-1",
    generatedAt: "2026-09-05T10:05:00.000Z",
    usage: { inputTokens: 1_500, contextWindow: 32_000, source: "estimated" },
    messages: { included: 1, omitted: 0 },
    sources: [],
    skills: [],
    summary: null,
    omissions: [],
  },
  retry: null,
};

const row: ChatRunUsageEventSummaryRow = {
  run_id: "run-1",
  run_attempt: 1,
  source: "model",
  event_count: 2,
  cost_micros: 20_000,
  credit_micros: 25_000,
  estimated_price_event_count: 1,
  input_tokens: 1_200,
};

describe("buildChatRunUsage", () => {
  it("combines retries without treating current estimates as recorded consumption", () => {
    const usage = buildChatRunUsage(run, [row], {
      id: "chat_run:run-1",
      user_id: 1,
      period: "2026-09",
      kind: "chat_run",
      ref_id: "run-1",
      credit_micros: 50_000,
      status: "held",
      expires_at: "2026-09-06T10:00:00.000Z",
      created_at: "2026-09-05T10:00:00.000Z",
      updated_at: null,
    });

    expect(usage.measurement).toBe("mixed");
    expect(usage.consumption).toMatchObject({
      status: "recorded",
      eventCount: 2,
      costMicros: 20_000,
      creditMicros: 25_000,
    });
    expect(usage.attempts).toEqual([
      expect.objectContaining({ attempt: 1, measurement: "reported", inputTokens: 1_200 }),
      expect.objectContaining({
        attempt: 2,
        measurement: "estimated",
        inputTokens: 1_500,
        costMicros: null,
      }),
    ]);
    expect(usage.reservation).toMatchObject({ creditMicros: 50_000, status: "held" });
    expect(usage.settlement.status).toBe("pending");
  });

  it("represents missing provider usage as unknown rather than zero actual", () => {
    const usage = buildChatRunUsage({ ...run, context: null }, [], null);

    expect(usage.measurement).toBe("unknown");
    expect(usage.consumption).toEqual({
      status: "unknown",
      eventCount: 0,
      costMicros: null,
      creditMicros: null,
      estimatedPriceEventCount: 0,
      bySource: [],
    });
    expect(usage.attempts[0]).toMatchObject({ measurement: "unknown", costMicros: null });
    expect(usage.settlement).toEqual({ status: "missing", at: null });
  });
});
