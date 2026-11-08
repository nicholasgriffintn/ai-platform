import { describe, expect, it, vi } from "vitest";

import type { ApprovalClient, ApprovalControlState, ApprovalRecord } from "../index.js";
import { isInteractionError, resolveApproval } from "../index.js";

function record(overrides: Partial<ApprovalRecord> = {}): ApprovalRecord {
  return { id: "approval-1", status: "pending", ...overrides };
}

function createClient(params: {
  records: ApprovalRecord[];
  control?: ApprovalControlState;
  requested?: ApprovalRecord;
}): ApprovalClient {
  const pending = [...params.records];
  const requested = params.requested ?? record();
  let last: ApprovalRecord = requested;

  return {
    requestApproval: vi.fn(async () => requested),
    fetchApproval: vi.fn(async () => {
      const next = pending.shift();

      if (next) {
        last = next;
      }

      return last;
    }),
    fetchControlState: vi.fn(async () => params.control ?? null),
  };
}

type ResolveParams = Parameters<typeof resolveApproval>[0];

function resolve(
  client: ApprovalClient | undefined,
  overrides: Partial<ResolveParams> = {},
  emitted: Array<Record<string, unknown>> = [],
) {
  return resolveApproval({
    subject: "pnpm test",
    riskLevel: "network",
    trustLevel: "balanced",
    reason: "network command",
    agentStep: 1,
    emit: async (event) => {
      emitted.push(event);
    },
    guardExecution: vi.fn(),
    shouldRequireApproval: () => true,
    approvalWindowForRiskLevel: () => ({ timeoutSeconds: 120, escalateAfterSeconds: 30 }),
    approvalClient: client,
    pollIntervalMs: 1,
    eventPrefix: "command_approval",
    ...overrides,
  });
}

describe("resolveApproval", () => {
  it("throws a coded error when the run is cancelled while waiting", async () => {
    const client = createClient({
      records: [record({ status: "pending" })],
      control: { state: "cancelled", cancellationReason: "Run cancelled" },
    });

    await expect(resolve(client)).rejects.toSatisfy((error: unknown) =>
      isInteractionError(error, "approval_cancelled"),
    );
  });

  it("throws when approval is required but no client is configured", async () => {
    await expect(resolve(undefined)).rejects.toSatisfy((error: unknown) =>
      isInteractionError(error, "approval_unavailable"),
    );
  });
});
