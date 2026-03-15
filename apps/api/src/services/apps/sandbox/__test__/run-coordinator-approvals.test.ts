import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sandboxRunEventSchema } from "@assistant/schemas";

import {
	applyApprovalLifecycleTransitions,
	buildApprovalRecord,
} from "../run-coordinator/approvals";

describe("run coordinator approvals", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it("builds approval records with default timeout and escalation windows", () => {
		vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));

		const approval = buildApprovalRecord({
			runId: "run-123",
			command: "curl https://example.com",
			body: {},
		});

		expect(approval.status).toBe("pending");
		expect(approval.timeoutSeconds).toBe(120);
		expect(approval.escalateAfterSeconds).toBe(30);
		expect(approval.expiresAt).toBe("2026-03-15T12:02:00.000Z");
		expect(approval.escalationAt).toBe("2026-03-15T12:00:30.000Z");
	});

	it("transitions pending approvals to escalated and then timed_out", () => {
		const approval = {
			id: "approval-1",
			runId: "run-123",
			command: "curl https://example.com",
			status: "pending" as const,
			requestedAt: "2026-03-15T12:00:00.000Z",
			escalationAt: "2026-03-15T12:00:10.000Z",
			expiresAt: "2026-03-15T12:00:20.000Z",
		};

		const escalated = applyApprovalLifecycleTransitions(
			[approval],
			new Date("2026-03-15T12:00:11.000Z"),
		);
		expect(escalated.changed).toBe(true);
		expect(escalated.approvals[0].status).toBe("escalated");
		expect(escalated.approvals[0].escalatedAt).toBe("2026-03-15T12:00:11.000Z");

		const timedOut = applyApprovalLifecycleTransitions(
			escalated.approvals,
			new Date("2026-03-15T12:00:21.000Z"),
		);
		expect(timedOut.changed).toBe(true);
		expect(timedOut.approvals[0].status).toBe("timed_out");
		expect(timedOut.approvals[0].timedOutAt).toBe("2026-03-15T12:00:21.000Z");
		expect(timedOut.approvals[0].resolvedAt).toBe("2026-03-15T12:00:21.000Z");
		expect(timedOut.approvals[0].resolutionReason).toBe(
			"Approval request timed out",
		);
	});

	it("accepts approval lifecycle fields in run stream events", () => {
		const result = sandboxRunEventSchema.safeParse({
			type: "command_approval_timed_out",
			runId: "run-123",
			command: "curl https://example.com",
			message: "Approval timed out",
			approvalId: "approval-1",
			approvalStatus: "timed_out",
			approvalExpiresAt: "2026-03-15T12:00:20.000Z",
			approvalEscalatedAt: "2026-03-15T12:00:11.000Z",
			approvalTimedOutAt: "2026-03-15T12:00:21.000Z",
		});

		expect(result.success).toBe(true);
	});
});
