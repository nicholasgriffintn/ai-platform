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

  it("sums each user's requests into one ledger event and acknowledges them", async () => {
    mocks.emitUsageEvents.mockResolvedValue("written");
    const first = requestUsage(1, "request-1");
    const second = requestUsage(1, "request-2");
    const other = requestUsage(2, "request-3");

    await rollUpUsageMessages({} as any, [first, second, other]);

    const drafts = mocks.emitUsageEvents.mock.calls.flatMap(([, params]) => params.drafts);

    expect(drafts.map((draft: { quantity: number }) => draft.quantity)).toEqual([80, 40]);
    expect(first.ack).toHaveBeenCalledOnce();
    expect(second.ack).toHaveBeenCalledOnce();
    expect(other.ack).toHaveBeenCalledOnce();
  });

  it("retries only the user whose ledger write failed", async () => {
    mocks.emitUsageEvents.mockResolvedValueOnce("written").mockResolvedValueOnce("failed");
    const written = requestUsage(1, "request-1");
    const failed = requestUsage(2, "request-2");

    await rollUpUsageMessages({} as any, [written, failed]);

    expect(written.ack).toHaveBeenCalledOnce();
    expect(written.retry).not.toHaveBeenCalled();
    expect(failed.retry).toHaveBeenCalledOnce();
    expect(failed.ack).not.toHaveBeenCalled();
  });

  it("sheds request usage but still records model usage while the breaker is open", async () => {
    mocks.applyUsageRollup.mockResolvedValue({ inserted: 1 });
    const request = requestUsage(1, "request-1");
    const events = usageMessage({ kind: "usage_events", events: [{ id: "event-1" }] });
    const env = { CACHE: { get: vi.fn(async () => "52428800") } };

    await rollUpUsageMessages(env as any, [request, events]);

    expect(mocks.emitUsageEvents).not.toHaveBeenCalled();
    expect(request.ack).toHaveBeenCalledOnce();
    expect(mocks.applyUsageRollup).toHaveBeenCalledOnce();
    expect(events.ack).toHaveBeenCalledOnce();
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
