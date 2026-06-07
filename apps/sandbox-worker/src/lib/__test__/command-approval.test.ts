import type { SandboxRunInstruction } from "@assistant/schemas";
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
		.mockResolvedValueOnce(jsonResponse({ instruction: approvalInstruction("pending") }))
		.mockResolvedValueOnce(
			jsonResponse({
				runId: "run-1",
				state: "running",
				updatedAt: createdAt,
			}),
		)
		.mockResolvedValueOnce(
			jsonResponse({
				instructions: [
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
	it("does not request approval for trusted runs", async () => {
		const emit = vi.fn();
		const guardExecution = vi.fn();

		const result = await resolveCommandApproval({
			command: "pnpm test",
			riskLevel: "risky",
			trustLevel: "trusted",
			agentStep: 1,
			emit,
			guardExecution,
		});

		expect(result).toEqual({
			allowNetwork: false,
			allowRisky: false,
			rejected: false,
		});
		expect(emit).not.toHaveBeenCalled();
		expect(guardExecution).not.toHaveBeenCalled();
	});

	it("allows approved network commands and emits request and resolution events", async () => {
		const { client, fetch } = createApprovalClient("approved");
		const emitted: Array<{ type: string; approvalStatus?: string }> = [];

		const result = await resolveCommandApproval({
			command: "pnpm test",
			riskLevel: "network",
			trustLevel: "balanced",
			agentStep: 2,
			approvalClient: client,
			emit: async (event) => {
				emitted.push({
					type: event.type,
					approvalStatus: "approvalStatus" in event ? event.approvalStatus : undefined,
				});
			},
			guardExecution: vi.fn(),
		});

		expect(result).toEqual({
			allowNetwork: true,
			allowRisky: false,
			rejected: false,
		});
		expect(fetch).toHaveBeenCalledTimes(3);
		expect(emitted).toEqual([
			{ type: "command_approval_requested", approvalStatus: "pending" },
			{ type: "command_approval_resolved", approvalStatus: "approved" },
		]);
	});

	it("returns a rejected result when approval is rejected", async () => {
		const { client } = createApprovalClient("rejected");

		const result = await resolveCommandApproval({
			command: "pnpm test",
			riskLevel: "network",
			trustLevel: "balanced",
			agentStep: 2,
			approvalClient: client,
			emit: vi.fn(),
			guardExecution: vi.fn(),
		});

		expect(result).toEqual({
			allowNetwork: false,
			allowRisky: false,
			rejected: true,
			rejectedMessage: "Not allowed",
		});
	});

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
