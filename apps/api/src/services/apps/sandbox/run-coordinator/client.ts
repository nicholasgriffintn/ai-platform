import {
	sandboxRunControlSchema,
	sandboxRunInstructionEnvelopeSchema,
	sandboxRunInstructionSchema,
	type SandboxRunControl,
	type SandboxRunEvent,
	type SandboxRunInstruction,
} from "@assistant/schemas";
import type { IEnv } from "~/types";
import type {
	CoordinatorEventEnvelope,
	CoordinatorInstructionEnvelope,
} from "./types";

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

export async function listRunCoordinatorEvents(params: {
	env: IEnv | undefined;
	runId: string;
	after?: number;
}): Promise<CoordinatorEventEnvelope[]> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return [];
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const url = new URL("https://sandbox-run-coordinator/events");
	if (typeof params.after === "number" && Number.isFinite(params.after)) {
		url.searchParams.set("after", String(params.after));
	}
	const response = await stub.fetch(url.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
	});
	if (!response.ok) {
		return [];
	}
	const payload = (await response.json()) as {
		events?: CoordinatorEventEnvelope[];
	};
	return Array.isArray(payload.events) ? payload.events : [];
}

export async function openRunCoordinatorEventsSocket(params: {
	env: IEnv | undefined;
	runId: string;
}): Promise<WebSocket | null> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}

	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		"https://sandbox-run-coordinator/events/ws",
		{
			headers: {
				Upgrade: "websocket",
			},
		},
	);

	const socket = response.webSocket;
	if (!socket) {
		return null;
	}

	socket.accept();
	return socket;
}

export async function submitRunCoordinatorInstruction(params: {
	env: IEnv | undefined;
	runId: string;
	kind: "message" | "continue" | "approval_request" | "approval_response";
	content?: string;
	command?: string;
	requestId?: string;
	approvalStatus?: "approved" | "rejected";
	timeoutSeconds?: number;
	escalateAfterSeconds?: number;
}): Promise<SandboxRunInstruction | null> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return null;
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const response = await stub.fetch(
		"https://sandbox-run-coordinator/instructions",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				kind: params.kind,
				content: params.content,
				command: params.command,
				requestId: params.requestId,
				approvalStatus: params.approvalStatus,
				timeoutSeconds: params.timeoutSeconds,
				escalateAfterSeconds: params.escalateAfterSeconds,
			}),
		},
	);
	if (!response.ok) {
		return null;
	}
	const payload = (await response.json()) as {
		instruction?: unknown;
	};
	const parsed = sandboxRunInstructionSchema.safeParse(payload.instruction);
	return parsed.success ? parsed.data : null;
}

export async function listRunCoordinatorInstructions(params: {
	env: IEnv | undefined;
	runId: string;
	after?: number;
}): Promise<CoordinatorInstructionEnvelope[]> {
	if (!params.env?.SANDBOX_RUN_COORDINATOR) {
		return [];
	}
	const stub = getCoordinatorStub(params.env, params.runId);
	const url = new URL("https://sandbox-run-coordinator/instructions");
	if (typeof params.after === "number" && Number.isFinite(params.after)) {
		url.searchParams.set("after", String(params.after));
	}
	const response = await stub.fetch(url.toString(), {
		method: "GET",
		headers: { Accept: "application/json" },
	});
	if (!response.ok) {
		return [];
	}
	const payload = (await response.json()) as {
		instructions?: unknown[];
	};
	if (!Array.isArray(payload.instructions)) {
		return [];
	}

	const instructions: CoordinatorInstructionEnvelope[] = [];
	for (const entry of payload.instructions) {
		const parsed = sandboxRunInstructionEnvelopeSchema.safeParse(entry);
		if (parsed.success) {
			instructions.push(parsed.data);
		}
	}
	return instructions;
}
