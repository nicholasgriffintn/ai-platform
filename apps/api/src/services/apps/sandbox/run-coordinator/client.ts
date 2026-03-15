import {
	sandboxRunControlSchema,
	type SandboxRunControl,
	type SandboxRunEvent,
} from "@assistant/schemas";
import type { IEnv } from "~/types";
import type { SandboxRunApprovalRecord } from "./types";

function getCoordinatorStub(
	env: IEnv | undefined,
	runId: string,
): DurableObjectStub {
	if (!env?.SANDBOX_RUN_COORDINATOR) {
		throw new Error("SANDBOX_RUN_COORDINATOR binding is not configured");
	}
	const id = env.SANDBOX_RUN_COORDINATOR.idFromName(runId);
	return env.SANDBOX_RUN_COORDINATOR.get(id);
}

export async function initRunCoordinatorControl(
	env: IEnv | undefined,
	control: SandboxRunControl,
): Promise<void> {
	if (!env?.SANDBOX_RUN_COORDINATOR) {
		return;
	}
	const stub = getCoordinatorStub(env, control.runId);
	await stub.fetch("https://sandbox-run-coordinator/control/init", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(control),
	});
}

export async function updateRunCoordinatorControl(params: {
	env: IEnv | undefined;
	runId: string;
	state?: SandboxRunControl["state"];
	updatedAt?: string;
	cancellationReason?: string;
	pauseReason?: string;
	timeoutSeconds?: number;
	timeoutAt?: string;
}): Promise<SandboxRunControl | null> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		"https://sandbox-run-coordinator/control/update",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				state: params.state,
				updatedAt: params.updatedAt,
				cancellationReason: params.cancellationReason,
				pauseReason: params.pauseReason,
				timeoutSeconds: params.timeoutSeconds,
				timeoutAt: params.timeoutAt,
			}),
		},
	);
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as unknown;
	const parsed = sandboxRunControlSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

export async function getRunCoordinatorControl(
	env: IEnv | undefined,
	runId: string,
): Promise<SandboxRunControl | null> {
	if (!env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}
	const stub = getCoordinatorStub(env, runId);
	const response = await stub.fetch("https://sandbox-run-coordinator/control");
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as unknown;
	const parsed = sandboxRunControlSchema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

export async function appendRunCoordinatorEvent(params: {
	env: IEnv | undefined;
	runId: string;
	event: SandboxRunEvent;
}): Promise<void> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	await stub.fetch("https://sandbox-run-coordinator/events", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(params.event),
	});
}

export async function requestRunCoordinatorApproval(params: {
	env: IEnv | undefined;
	runId: string;
	command: string;
	reason?: string;
}): Promise<SandboxRunApprovalRecord | null> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		"https://sandbox-run-coordinator/approval/request",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				command: params.command,
				reason: params.reason,
			}),
		},
	);
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as {
		approval?: SandboxRunApprovalRecord;
	};
	return payload.approval ?? null;
}

export async function resolveRunCoordinatorApproval(params: {
	env: IEnv | undefined;
	runId: string;
	approvalId: string;
	status: "approved" | "rejected";
	reason?: string;
}): Promise<boolean> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return false;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		"https://sandbox-run-coordinator/approval/resolve",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				id: params.approvalId,
				status: params.status,
				reason: params.reason,
			}),
		},
	);
	return response.ok;
}

export async function listRunCoordinatorApprovals(
	env: IEnv | undefined,
	runId: string,
): Promise<SandboxRunApprovalRecord[]> {
	if (!env?.SANDBOX_RUN_COORDINATOR) {
		return [];
	}
	const stub = getCoordinatorStub(env, runId);
	const response = await stub.fetch("https://sandbox-run-coordinator/approval");
	if (!response.ok) {
		return [];
	}
	const payload = (await response.json()) as {
		approvals?: SandboxRunApprovalRecord[];
	};
	return payload.approvals ?? [];
}

export async function getRunCoordinatorApproval(params: {
	env: IEnv | undefined;
	runId: string;
	approvalId: string;
}): Promise<SandboxRunApprovalRecord | null> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		`https://sandbox-run-coordinator/approval/${encodeURIComponent(params.approvalId)}`,
	);
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as {
		approval?: SandboxRunApprovalRecord;
	};
	return payload.approval ?? null;
}
