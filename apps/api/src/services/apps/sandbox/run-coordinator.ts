import type { SandboxRunControl, SandboxRunEvent } from "@assistant/schemas";
import { sandboxRunControlSchema } from "@assistant/schemas";
import type { IEnv } from "~/types";

type CoordinatorState = SandboxRunControl;

interface CoordinatorEventEnvelope {
	index: number;
	event: SandboxRunEvent;
	recordedAt: string;
}

interface ApprovalRequest {
	id: string;
	command: string;
	requestedAt: string;
	status: "pending" | "approved" | "rejected";
	resolvedAt?: string;
	resolutionReason?: string;
}

const CONTROL_KEY = "control";
const EVENTS_KEY = "events";
const EVENT_INDEX_KEY = "event-index";
const APPROVALS_KEY = "approvals";

function toJson(data: unknown, status = 200): Response {
	return Response.json(data, { status });
}

function parseJson<T>(value: string): T | null {
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

export class SandboxRunCoordinator implements DurableObject {
	constructor(private readonly state: DurableObjectState) {}

	private async getControl(): Promise<CoordinatorState | null> {
		const raw = await this.state.storage.get<string>(CONTROL_KEY);
		if (!raw) {
			return null;
		}
		const parsed = parseJson<unknown>(raw);
		const valid = sandboxRunControlSchema.safeParse(parsed);
		return valid.success ? valid.data : null;
	}

	private async putControl(control: CoordinatorState): Promise<void> {
		await this.state.storage.put(CONTROL_KEY, JSON.stringify(control));
	}

	private async appendEvent(
		event: SandboxRunEvent,
	): Promise<CoordinatorEventEnvelope> {
		const currentIndex =
			(await this.state.storage.get<number>(EVENT_INDEX_KEY)) ?? 0;
		const nextIndex = currentIndex + 1;
		const envelope: CoordinatorEventEnvelope = {
			index: nextIndex,
			event,
			recordedAt: new Date().toISOString(),
		};

		const raw = await this.state.storage.get<string>(EVENTS_KEY);
		const existing = raw
			? (parseJson<CoordinatorEventEnvelope[]>(raw) ?? [])
			: [];
		const nextEvents = [...existing, envelope].slice(-500);

		await this.state.storage.put(EVENT_INDEX_KEY, nextIndex);
		await this.state.storage.put(EVENTS_KEY, JSON.stringify(nextEvents));
		return envelope;
	}

	private async getApprovals(): Promise<ApprovalRequest[]> {
		const raw = await this.state.storage.get<string>(APPROVALS_KEY);
		if (!raw) {
			return [];
		}
		return parseJson<ApprovalRequest[]>(raw) ?? [];
	}

	private async putApprovals(approvals: ApprovalRequest[]): Promise<void> {
		await this.state.storage.put(
			APPROVALS_KEY,
			JSON.stringify(approvals.slice(-200)),
		);
	}

	public async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		if (pathname === "/control" && request.method === "GET") {
			const control = await this.getControl();
			if (!control) {
				return toJson({ error: "Control state not initialised" }, 404);
			}
			return toJson(control);
		}

		if (pathname === "/control/init" && request.method === "POST") {
			const payload = (await request.json()) as unknown;
			const parsed = sandboxRunControlSchema.safeParse(payload);
			if (!parsed.success) {
				return toJson({ error: "Invalid control payload" }, 400);
			}
			await this.putControl(parsed.data);
			return toJson({ success: true });
		}

		if (pathname === "/control/update" && request.method === "POST") {
			const existing = await this.getControl();
			if (!existing) {
				return toJson({ error: "Control state not initialised" }, 404);
			}
			const payload = (await request.json()) as Record<string, unknown>;
			const nextState =
				payload.state === "running" ||
				payload.state === "paused" ||
				payload.state === "cancelled"
					? payload.state
					: undefined;
			const next: CoordinatorState = {
				...existing,
				...(nextState ? { state: nextState } : {}),
				...(typeof payload.updatedAt === "string"
					? { updatedAt: payload.updatedAt }
					: { updatedAt: new Date().toISOString() }),
				...(typeof payload.cancellationReason === "string"
					? { cancellationReason: payload.cancellationReason }
					: {}),
				...(typeof payload.pauseReason === "string"
					? { pauseReason: payload.pauseReason }
					: {}),
				...(typeof payload.timeoutSeconds === "number"
					? { timeoutSeconds: payload.timeoutSeconds }
					: {}),
				...(typeof payload.timeoutAt === "string"
					? { timeoutAt: payload.timeoutAt }
					: {}),
			};
			const validated = sandboxRunControlSchema.safeParse(next);
			if (!validated.success) {
				return toJson({ error: "Invalid control update payload" }, 400);
			}

			await this.putControl(validated.data);
			return toJson(validated.data);
		}

		if (pathname === "/events" && request.method === "POST") {
			const event = (await request.json()) as SandboxRunEvent;
			const envelope = await this.appendEvent(event);
			return toJson(envelope);
		}

		if (pathname === "/events" && request.method === "GET") {
			const afterRaw = url.searchParams.get("after");
			const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
			const raw = await this.state.storage.get<string>(EVENTS_KEY);
			const events = raw
				? (parseJson<CoordinatorEventEnvelope[]>(raw) ?? [])
				: [];
			return toJson({
				events: events.filter(
					(entry) => entry.index > (Number.isFinite(after) ? after : 0),
				),
			});
		}

		if (pathname === "/approval/request" && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			const command =
				typeof body.command === "string" ? body.command.trim() : "";
			if (!command) {
				return toJson({ error: "command is required" }, 400);
			}

			const approvals = await this.getApprovals();
			const approval: ApprovalRequest = {
				id: crypto.randomUUID(),
				command,
				status: "pending",
				requestedAt: new Date().toISOString(),
			};
			approvals.push(approval);
			await this.putApprovals(approvals);
			return toJson({ approval });
		}

		if (pathname === "/approval/resolve" && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			const id = typeof body.id === "string" ? body.id.trim() : "";
			const status =
				body.status === "approved" || body.status === "rejected"
					? body.status
					: undefined;
			if (!id || !status) {
				return toJson({ error: "id and status are required" }, 400);
			}

			const approvals = await this.getApprovals();
			const nextApprovals: ApprovalRequest[] = approvals.map((entry) =>
				entry.id === id
					? {
							...entry,
							status: status as ApprovalRequest["status"],
							resolvedAt: new Date().toISOString(),
							resolutionReason:
								typeof body.reason === "string"
									? body.reason
									: entry.resolutionReason,
						}
					: entry,
			);
			await this.putApprovals(nextApprovals);
			return toJson({ success: true });
		}

		if (pathname === "/approval" && request.method === "GET") {
			const approvals = await this.getApprovals();
			return toJson({ approvals });
		}

		return toJson({ error: "Not found" }, 404);
	}
}

function getCoordinatorStub(
	env: IEnv | undefined,
	runId: string,
): DurableObjectStub {
	if (!env.SANDBOX_RUN_COORDINATOR) {
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
	env: IEnv;
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
	env: IEnv;
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
