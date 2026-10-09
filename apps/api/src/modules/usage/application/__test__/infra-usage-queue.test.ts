import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitUsageEvents: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-billing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-billing")>()),
  emitUsageEvents: mocks.emitUsageEvents,
}));

vi.mock("../runtime", () => ({
  createUsageRuntime: vi.fn(() => ({})),
}));

import { rollUpInfraUsageMessages } from "../infra-usage-queue";

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

describe("rollUpInfraUsageMessages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes every request in the batch in one emission and acknowledges them", async () => {
    mocks.emitUsageEvents.mockResolvedValue("written");
    const first = requestUsage(1, "request-1");
    const second = requestUsage(2, "request-2");

    await rollUpInfraUsageMessages({} as any, [first, second]);

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

    await rollUpInfraUsageMessages({} as any, [valid, malformed]);

    expect(valid.retry).toHaveBeenCalledOnce();
    expect(valid.ack).not.toHaveBeenCalled();
    expect(malformed.ack).toHaveBeenCalledOnce();
  });
});
