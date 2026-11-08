import type { SandboxRunInstruction } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it, vi } from "vitest";

import { resolveCommandApproval } from "../feature-implementation/command-approval";
import { RunControlClient } from "../run-control-client";

const createdAt = "2026-06-07T12:00:00.000Z";

function approvalInstruction(
  approvalStatus: NonNullable<SandboxRunInstruction["approvalStatus"]>,
  overrides: Partial<SandboxRunInstruction> = {},
): SandboxRunInstruction {
  return {
    id: "approval-1",
    runId: "run-1",
    kind: "approval_request",
    command: "pnpm test",
    content: "network command in default trust mode",
    approvalStatus,
    createdAt,
    ...overrides,
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function createApprovalClient(status: NonNullable<SandboxRunInstruction["approvalStatus"]>) {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(approvalInstruction("pending")))
    .mockResolvedValueOnce(
      jsonResponse({
        runId: "run-1",
        state: "running",
        updatedAt: createdAt,
      }),
    )
    .mockResolvedValueOnce(
      jsonResponse({
        object: "list",
        has_more: false,
        last_id: "1",
        data: [
          {
            index: 1,
            recordedAt: createdAt,
            instruction: approvalInstruction(status, {
              resolutionReason: status === "rejected" ? "Not allowed" : undefined,
              timedOutAt: status === "timed_out" ? createdAt : undefined,
            }),
          },
        ],
      }),
    );

  return {
    client: new RunControlClient({
      userToken: "token",
      runId: "run-1",
      apiService: { fetch },
      requestTimeoutMs: 100,
    }),
    fetch,
  };
}

describe("resolveCommandApproval", () => {
  it("returns a rejected result when approval times out", async () => {
    const { client } = createApprovalClient("timed_out");

    const result = await resolveCommandApproval({
      command: "pnpm test",
      riskLevel: "risky",
      trustLevel: "strict",
      agentStep: 2,
      approvalClient: client,
      emit: vi.fn(),
      guardExecution: vi.fn(),
    });

    expect(result).toEqual({
      allowNetwork: false,
      allowRisky: false,
      rejected: true,
      rejectedMessage: "Command approval timed out before a decision was made.",
    });
  });
});
