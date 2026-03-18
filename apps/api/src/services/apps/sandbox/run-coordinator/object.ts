import {
	sandboxRunControlSchema,
	sandboxRunInstructionKindSchema,
	type SandboxRunEvent,
	type SandboxRunInstruction,
} from "@assistant/schemas";
import { safeParseJson } from "~/utils/json";
import type {
	CoordinatorEventEnvelope,
	CoordinatorInstructionEnvelope,
	CoordinatorState,
	SandboxRunInstructionRecord,
} from "./types";

const CONTROL_KEY = "control";
const EVENTS_KEY = "events";
const EVENT_INDEX_KEY = "event-index";
const INSTRUCTIONS_KEY = "instructions";
const INSTRUCTION_INDEX_KEY = "instruction-index";
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

export class SandboxRunCoordinator implements DurableObject {
	constructor(private readonly state: DurableObjectState) {}

	private broadcastEnvelope(envelope: CoordinatorEventEnvelope): void {
		const payload = JSON.stringify(envelope);
		for (const socket of this.state.getWebSockets()) {
			try {
				socket.send(payload);
			} catch {
				try {
					socket.close(1011, "Coordinator broadcast failed");
				} catch {
					// Ignore socket close failures.
				}
			}
		}
	}

	private async getControl(): Promise<CoordinatorState | null> {
		const raw = await this.state.storage.get<string>(CONTROL_KEY);
		if (!raw) {
			return null;
		}
		const parsed = safeParseJson<unknown>(raw);
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
			? (safeParseJson<CoordinatorEventEnvelope[]>(raw) ?? [])
			: [];
		const nextEvents = [...existing, envelope].slice(-500);

		await this.state.storage.put(EVENT_INDEX_KEY, nextIndex);
		await this.state.storage.put(EVENTS_KEY, JSON.stringify(nextEvents));
		this.broadcastEnvelope(envelope);
		return envelope;
	}

	private async appendInstruction(
		instruction: SandboxRunInstructionRecord,
	): Promise<CoordinatorInstructionEnvelope> {
		const currentIndex =
			(await this.state.storage.get<number>(INSTRUCTION_INDEX_KEY)) ?? 0;
		const nextIndex = currentIndex + 1;
		const envelope: CoordinatorInstructionEnvelope = {
			index: nextIndex,
			instruction,
			recordedAt: new Date().toISOString(),
		};

		const raw = await this.state.storage.get<string>(INSTRUCTIONS_KEY);
		const existing = raw
			? (safeParseJson<CoordinatorInstructionEnvelope[]>(raw) ?? [])
			: [];
		const nextInstructions = [...existing, envelope].slice(-500);

		await this.state.storage.put(INSTRUCTION_INDEX_KEY, nextIndex);
		await this.state.storage.put(
			INSTRUCTIONS_KEY,
			JSON.stringify(nextInstructions),
		);
		return envelope;
	}

	private async getInstructions(): Promise<CoordinatorInstructionEnvelope[]> {
		const raw = await this.state.storage.get<string>(INSTRUCTIONS_KEY);
		return raw
			? (safeParseJson<CoordinatorInstructionEnvelope[]>(raw) ?? [])
			: [];
	}

	private async putInstructions(
		instructions: CoordinatorInstructionEnvelope[],
	): Promise<void> {
		await this.state.storage.put(
			INSTRUCTIONS_KEY,
			JSON.stringify(instructions.slice(-500)),
		);
	}

	private applyInstructionLifecycleTransitions(
		instructions: CoordinatorInstructionEnvelope[],
		now: Date = new Date(),
	): {
		instructions: CoordinatorInstructionEnvelope[];
		changed: boolean;
	} {
		let changed = false;
		const nowMs = now.getTime();
		const nowIso = now.toISOString();
		const nextInstructions = instructions.map((entry) => {
			const instruction = entry.instruction;
			if (instruction.kind !== "approval_request") {
				return entry;
			}
			if (
				instruction.approvalStatus === "approved" ||
				instruction.approvalStatus === "rejected" ||
				instruction.approvalStatus === "timed_out"
			) {
				return entry;
			}

			let nextInstruction = instruction;
			if (
				instruction.approvalStatus === "pending" &&
				instruction.escalationAt &&
				Date.parse(instruction.escalationAt) <= nowMs
			) {
				nextInstruction = {
					...nextInstruction,
					approvalStatus: "escalated",
					escalatedAt: nextInstruction.escalatedAt ?? nowIso,
				};
				changed = true;
			}

			if (
				(nextInstruction.approvalStatus === "pending" ||
					nextInstruction.approvalStatus === "escalated") &&
				nextInstruction.expiresAt &&
				Date.parse(nextInstruction.expiresAt) <= nowMs
			) {
				nextInstruction = {
					...nextInstruction,
					approvalStatus: "timed_out",
					timedOutAt: nextInstruction.timedOutAt ?? nowIso,
					resolvedAt: nextInstruction.resolvedAt ?? nowIso,
					resolutionReason:
						nextInstruction.resolutionReason ?? APPROVAL_TIMEOUT_REASON,
				};
				changed = true;
			}

			return {
				...entry,
				instruction: nextInstruction,
			};
		});

		return {
			instructions: nextInstructions,
			changed,
		};
	}

	private async getInstructionsWithLifecycle(): Promise<
		CoordinatorInstructionEnvelope[]
	> {
		const instructions = await this.getInstructions();
		const transitioned =
			this.applyInstructionLifecycleTransitions(instructions);
		if (transitioned.changed) {
			await this.putInstructions(transitioned.instructions);
		}
		return transitioned.instructions;
	}

	public async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

		if (
			pathname === "/events/ws" &&
			request.headers.get("Upgrade")?.toLowerCase() === "websocket"
		) {
			const pair = new WebSocketPair();
			const client = pair[0];
			const server = pair[1];
			this.state.acceptWebSocket(server);
			server.send(
				JSON.stringify({
					type: "ready",
					recordedAt: new Date().toISOString(),
				}),
			);
			return new Response(null, {
				status: 101,
				webSocket: client,
			});
		}

		if (pathname === "/control" && request.method === "GET") {
			const control = await this.getControl();
			if (!control) {
				return Response.json(
					{ error: "Control state not initialised" },
					{ status: 404 },
				);
			}
			return Response.json(control);
		}

		if (pathname === "/control/init" && request.method === "POST") {
			const payload = (await request.json()) as unknown;
			const parsed = sandboxRunControlSchema.safeParse(payload);
			if (!parsed.success) {
				return Response.json(
					{ error: "Invalid control payload" },
					{ status: 400 },
				);
			}
			await this.putControl(parsed.data);
			return Response.json({ success: true });
		}

		if (pathname === "/control/update" && request.method === "POST") {
			const existing = await this.getControl();
			if (!existing) {
				return Response.json(
					{ error: "Control state not initialised" },
					{ status: 404 },
				);
			}
			const payload = (await request.json()) as Record<string, unknown>;
			const nextState =
				payload.state === "queued" ||
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
				return Response.json(
					{ error: "Invalid control update payload" },
					{ status: 400 },
				);
			}

			await this.putControl(validated.data);
			return Response.json(validated.data);
		}

		if (pathname === "/events" && request.method === "POST") {
			const event = (await request.json()) as SandboxRunEvent;
			const envelope = await this.appendEvent(event);
			return Response.json(envelope);
		}

		if (pathname === "/events" && request.method === "GET") {
			const afterRaw = url.searchParams.get("after");
			const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
			const raw = await this.state.storage.get<string>(EVENTS_KEY);
			const events = raw
				? (safeParseJson<CoordinatorEventEnvelope[]>(raw) ?? [])
				: [];
			return Response.json({
				events: events.filter(
					(entry) => entry.index > (Number.isFinite(after) ? after : 0),
				),
			});
		}

		if (pathname === "/instructions" && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			const parsedKind = sandboxRunInstructionKindSchema.safeParse(body.kind);
			const kind = parsedKind.success ? parsedKind.data : "message";
			const contentRaw =
				typeof body.content === "string" ? body.content.trim() : "";
			if (kind === "message" && !contentRaw) {
				return Response.json(
					{ error: "content is required for message instructions" },
					{ status: 400 },
				);
			}

			const control = await this.getControl();
			const nowIso = new Date().toISOString();

			if (kind === "approval_request") {
				const command =
					typeof body.command === "string" ? body.command.trim() : "";
				if (!command) {
					return Response.json(
						{ error: "command is required" },
						{ status: 400 },
					);
				}
				const timeoutSeconds =
					parsePositiveInt(
						body.timeoutSeconds,
						MIN_APPROVAL_TIMEOUT_SECONDS,
						MAX_APPROVAL_TIMEOUT_SECONDS,
					) ?? DEFAULT_APPROVAL_TIMEOUT_SECONDS;
				const requestedEscalateAfterSeconds = parsePositiveInt(
					body.escalateAfterSeconds,
					MIN_APPROVAL_ESCALATE_SECONDS,
					MAX_APPROVAL_ESCALATE_SECONDS,
				);
				const escalateAfterSeconds = Math.min(
					requestedEscalateAfterSeconds ??
						DEFAULT_APPROVAL_ESCALATE_AFTER_SECONDS,
					Math.max(1, timeoutSeconds - 1),
				);
				const instruction: SandboxRunInstruction = {
					id: crypto.randomUUID(),
					runId: control?.runId ?? "unknown",
					kind,
					content: contentRaw || undefined,
					command,
					approvalStatus: "pending",
					timeoutSeconds,
					escalateAfterSeconds,
					expiresAt: addSecondsIso(nowIso, timeoutSeconds),
					escalationAt: addSecondsIso(nowIso, escalateAfterSeconds),
					createdAt: nowIso,
				};
				const envelope = await this.appendInstruction(instruction);
				return Response.json({ instruction: envelope.instruction, envelope });
			}

			if (kind === "approval_response") {
				const requestId =
					typeof body.requestId === "string" ? body.requestId.trim() : "";
				const approvalStatus =
					body.approvalStatus === "approved" ||
					body.approvalStatus === "rejected"
						? body.approvalStatus
						: undefined;
				if (!requestId || !approvalStatus) {
					return Response.json(
						{ error: "requestId and approvalStatus are required" },
						{ status: 400 },
					);
				}

				const instructions = await this.getInstructionsWithLifecycle();
				const requestIndex = instructions.findIndex(
					(entry) =>
						entry.instruction.kind === "approval_request" &&
						entry.instruction.id === requestId,
				);
				if (requestIndex < 0) {
					return Response.json(
						{ error: "Approval request not found" },
						{ status: 404 },
					);
				}

				const requestInstruction = instructions[requestIndex].instruction;
				if (
					requestInstruction.approvalStatus === "approved" ||
					requestInstruction.approvalStatus === "rejected" ||
					requestInstruction.approvalStatus === "timed_out"
				) {
					return Response.json(
						{ error: "Approval request already resolved" },
						{ status: 409 },
					);
				}

				instructions[requestIndex] = {
					...instructions[requestIndex],
					instruction: {
						...requestInstruction,
						approvalStatus,
						resolvedAt: nowIso,
						resolutionReason: contentRaw || requestInstruction.resolutionReason,
					},
				};
				await this.putInstructions(instructions);

				const instruction: SandboxRunInstruction = {
					id: crypto.randomUUID(),
					runId: control?.runId ?? "unknown",
					kind,
					requestId,
					approvalStatus,
					content: contentRaw || undefined,
					createdAt: nowIso,
				};
				const envelope = await this.appendInstruction(instruction);
				return Response.json({ instruction: envelope.instruction, envelope });
			}

			const instruction: SandboxRunInstruction = {
				id: crypto.randomUUID(),
				runId: control?.runId ?? "unknown",
				kind,
				content: contentRaw || undefined,
				createdAt: nowIso,
			};
			const envelope = await this.appendInstruction(instruction);
			return Response.json({ instruction: envelope.instruction, envelope });
		}

		if (pathname === "/instructions" && request.method === "GET") {
			const afterRaw = url.searchParams.get("after");
			const after = afterRaw ? Number.parseInt(afterRaw, 10) : 0;
			const instructions = await this.getInstructionsWithLifecycle();
			return Response.json({
				instructions: instructions.filter(
					(entry) => entry.index > (Number.isFinite(after) ? after : 0),
				),
			});
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}

	public webSocketMessage(
		_ws: WebSocket,
		_message: ArrayBuffer | string,
	): void {
		// Inbound messages are currently ignored; websocket clients subscribe-only.
	}

	public webSocketClose(ws: WebSocket): void {
		try {
			ws.close(1000, "Closed");
		} catch {
			// Ignore close errors.
		}
	}
}
