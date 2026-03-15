import { sandboxRunApprovalSchema } from "@assistant/schemas";

import { safeParseJson } from "~/utils/json";
import type { SandboxRunApprovalRecord } from "./types";

const DEFAULT_APPROVAL_TIMEOUT_SECONDS = 120;
const DEFAULT_APPROVAL_ESCALATE_AFTER_SECONDS = 30;
const MIN_APPROVAL_TIMEOUT_SECONDS = 5;
const MAX_APPROVAL_TIMEOUT_SECONDS = 1800;
const MIN_APPROVAL_ESCALATE_SECONDS = 1;
const MAX_APPROVAL_ESCALATE_SECONDS = 900;
const APPROVAL_TIMEOUT_REASON = "Approval request timed out";

function parsePositiveInt(
	value: unknown,
	min: number,
	max: number,
): number | undefined {
	if (typeof value !== "number" || !Number.isInteger(value)) {
		return undefined;
	}
	if (value < min || value > max) {
		return undefined;
	}
	return value;
}

function addSecondsIso(isoTimestamp: string, seconds: number): string {
	return new Date(Date.parse(isoTimestamp) + seconds * 1000).toISOString();
}

export function parseApprovalRecords(
	raw: string | null,
): SandboxRunApprovalRecord[] {
	if (!raw) {
		return [];
	}
	const parsed = safeParseJson<unknown>(raw);
	if (!Array.isArray(parsed)) {
		return [];
	}
	const approvals: SandboxRunApprovalRecord[] = [];
	for (const entry of parsed) {
		const valid = sandboxRunApprovalSchema.safeParse(entry);
		if (valid.success) {
			approvals.push(valid.data);
		}
	}
	return approvals;
}

export function buildApprovalRecord(params: {
	runId: string;
	command: string;
	body: Record<string, unknown>;
}): SandboxRunApprovalRecord {
	const requestedAt = new Date().toISOString();
	const timeoutSeconds =
		parsePositiveInt(
			params.body.timeoutSeconds,
			MIN_APPROVAL_TIMEOUT_SECONDS,
			MAX_APPROVAL_TIMEOUT_SECONDS,
		) ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS;
	const requestedEscalateAfterSeconds = parsePositiveInt(
		params.body.escalateAfterSeconds,
		MIN_APPROVAL_ESCALATE_SECONDS,
		MAX_APPROVAL_ESCALATE_SECONDS,
	);
	const escalateAfterSeconds = Math.min(
		requestedEscalateAfterSeconds ?? DEFAULT_APPROVAL_ESCALATE_AFTER_SECONDS,
		Math.max(1, timeoutSeconds - 1),
	);

	return {
		id: crypto.randomUUID(),
		runId: params.runId,
		command: params.command,
		status: "pending",
		requestedAt,
		requestReason:
			typeof params.body.reason === "string" ? params.body.reason : undefined,
		timeoutSeconds,
		escalateAfterSeconds,
		expiresAt: addSecondsIso(requestedAt, timeoutSeconds),
		escalationAt: addSecondsIso(requestedAt, escalateAfterSeconds),
	};
}

export function applyApprovalLifecycleTransitions(
	approvals: SandboxRunApprovalRecord[],
	now: Date = new Date(),
): {
	approvals: SandboxRunApprovalRecord[];
	changed: boolean;
} {
	const nowIso = now.toISOString();
	let changed = false;

	const nextApprovals = approvals.map((entry) => {
		if (
			entry.status === "approved" ||
			entry.status === "rejected" ||
			entry.status === "timed_out"
		) {
			return entry;
		}

		let nextEntry = entry;
		if (
			entry.status === "pending" &&
			entry.escalationAt &&
			Date.parse(entry.escalationAt) <= now.getTime()
		) {
			nextEntry = {
				...nextEntry,
				status: "escalated",
				escalatedAt: nextEntry.escalatedAt ?? nowIso,
			};
			changed = true;
		}

		if (
			(nextEntry.status === "pending" || nextEntry.status === "escalated") &&
			nextEntry.expiresAt &&
			Date.parse(nextEntry.expiresAt) <= now.getTime()
		) {
			nextEntry = {
				...nextEntry,
				status: "timed_out",
				timedOutAt: nextEntry.timedOutAt ?? nowIso,
				resolvedAt: nextEntry.resolvedAt ?? nowIso,
				resolutionReason: nextEntry.resolutionReason ?? APPROVAL_TIMEOUT_REASON,
			};
			changed = true;
		}

		return nextEntry;
	});

	return { approvals: nextApprovals, changed };
}
