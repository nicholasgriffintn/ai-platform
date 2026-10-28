import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitUsageEvents: vi.fn(),
  applyUsageRollup: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-billing")>()),
  emitUsageEvents: mocks.emitUsageEvents,
  applyUsageRollup: mocks.applyUsageRollup,
}));

vi.mock("../runtime", () => ({
  createUsageRuntime: vi.fn(() => ({})),
}));

import { rollUpUsageMessages } from "../infra-usage-queue";

function usageMessage(body: unknown) {
  return { id: "message", timestamp: new Date(), attempts: 1, body, ack: vi.fn(), retry: vi.fn() };
}

function requestUsage(userId: number, scopeKey: string) {
  return usageMessage({
    kind: "infra_usage",
    userId,
    scopeKey,
    occurredAt: "2026-10-09T12:00:00.000Z",
    quantities: [{ unit: "d1_rows_read", quantity: 40 }],
  });
}

describe("rollUpUsageMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes every request in the batch in one emission and acknowledges them", async () => {
    mocks.emitUsageEvents.mockResolvedValue("written");
    const first = requestUsage(1, "request-1");
    const second = requestUsage(2, "request-2");

    await rollUpUsageMessages({} as any, [first, second]);

    expect(mocks.emitUsageEvents).toHaveBeenCalledOnce();
    expect(
      mocks.emitUsageEvents.mock.calls[0][1].drafts.map(
        (draft: { idempotencyKey: string }) => draft.idempotencyKey,
      ),
    ).toEqual(["infra:request-1:d1_rows_read", "infra:request-2:d1_rows_read"]);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(second.ack).toHaveBeenCalledOnce();
  });

  it("retries the batch when the ledger write fails and drops malformed messages", async () => {
    mocks.emitUsageEvents.mockResolvedValue("failed");
    const valid = requestUsage(1, "request-1");
    const malformed = usageMessage({ kind: "infra_usage", userId: "nope" });

    await rollUpUsageMessages({} as any, [valid, malformed]);

    expect(valid.retry).toHaveBeenCalledOnce();
    expect(valid.ack).not.toHaveBeenCalled();
    expect(malformed.ack).toHaveBeenCalledOnce();
  });

  it("rolls up queued model usage events with request usage in the same batch", async () => {
    mocks.emitUsageEvents.mockResolvedValue("skipped");
    mocks.applyUsageRollup.mockResolvedValue({ inserted: 2 });
    const events = usageMessage({
      kind: "usage_events",
      events: [{ id: "event-1" }, { id: "event-2" }],
    });

    await rollUpUsageMessages({} as any, [events]);

    expect(mocks.applyUsageRollup).toHaveBeenCalledWith({}, [{ id: "event-1" }, { id: "event-2" }]);
    expect(events.ack).toHaveBeenCalledOnce();
  });

  it("retries model usage events when the ledger rejects them", async () => {
    mocks.emitUsageEvents.mockResolvedValue("skipped");
    mocks.applyUsageRollup.mockRejectedValue(new Error("D1 busy"));
    const events = usageMessage({ kind: "usage_events", events: [{ id: "event-1" }] });

    await rollUpUsageMessages({} as any, [events]);

    expect(events.retry).toHaveBeenCalledOnce();
    expect(events.ack).not.toHaveBeenCalled();
  });
});
