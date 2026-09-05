import { describe, expect, it } from "vitest";

import { chatRunSchema, chatRunUsageSchema } from "./index";

const usage = {
  protocolVersion: 1 as const,
  runId: "run-1",
  currentAttempt: 2,
  measurement: "mixed" as const,
  reservation: {
    creditMicros: 50_000,
    status: "settled" as const,
    expiresAt: "2026-09-06T10:00:00.000Z",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:05:00.000Z",
  },
  consumption: {
    status: "recorded" as const,
    eventCount: 2,
    costMicros: 20_000,
    creditMicros: 25_000,
    estimatedPriceEventCount: 1,
    bySource: [
      {
        source: "model" as const,
        eventCount: 2,
        costMicros: 20_000,
        creditMicros: 25_000,
        estimatedPriceEventCount: 1,
      },
    ],
  },
  attempts: [
    {
      attempt: 1,
      measurement: "reported" as const,
      inputTokens: 1_200,
      eventCount: 2,
      costMicros: 20_000,
      creditMicros: 25_000,
      estimatedPriceEventCount: 1,
    },
    {
      attempt: 2,
      measurement: "estimated" as const,
      inputTokens: 1_500,
      eventCount: 0,
      costMicros: null,
      creditMicros: null,
      estimatedPriceEventCount: 0,
    },
  ],
  settlement: { status: "settled" as const, at: "2026-09-05T10:05:00.000Z" },
};

describe("chat run usage", () => {
  it("keeps reservations, consumption, attempts and settlement distinct", () => {
    expect(chatRunUsageSchema.parse(usage)).toEqual(usage);
  });

  it("allows usage on a run without treating missing consumption as zero", () => {
    const parsed = chatRunSchema.parse({
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
      context: null,
      retry: null,
      usage: {
        ...usage,
        measurement: "unknown",
        reservation: null,
        consumption: {
          status: "unknown",
          eventCount: 0,
          costMicros: null,
          creditMicros: null,
          estimatedPriceEventCount: 0,
          bySource: [],
        },
        attempts: [],
        settlement: { status: "missing", at: null },
      },
    });

    expect(parsed.usage?.consumption.costMicros).toBeNull();
    expect(parsed.usage?.consumption.creditMicros).toBeNull();
  });
});
