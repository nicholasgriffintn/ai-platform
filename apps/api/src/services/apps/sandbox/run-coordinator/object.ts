import {
	sandboxRunControlSchema,
	type SandboxRunEvent,
} from "@assistant/schemas";
import { safeParseJson } from "~/utils/json";
import {
	applyApprovalLifecycleTransitions,
	buildApprovalRecord,
	parseApprovalRecords,
} from "./approvals";
import type {
	CoordinatorEventEnvelope,
	CoordinatorState,
	SandboxRunApprovalRecord,
} from "./types";

const CONTROL_KEY = "control";
const EVENTS_KEY = "events";
const EVENT_INDEX_KEY = "event-index";
const APPROVALS_KEY = "approvals";

export class SandboxRunCoordinator implements DurableObject {
	constructor(private readonly state: DurableObjectState) {}

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
		return envelope;
	}

	private async getApprovals(): Promise<SandboxRunApprovalRecord[]> {
		const raw = await this.state.storage.get<string>(APPROVALS_KEY);
		return parseApprovalRecords(raw ?? null);
	}

	private async putApprovals(
		approvals: SandboxRunApprovalRecord[],
	): Promise<void> {
		await this.state.storage.put(
			APPROVALS_KEY,
			JSON.stringify(approvals.slice(-200)),
		);
	}

	private applyApprovalLifecycleTransitions(
		approvals: SandboxRunApprovalRecord[],
	): {
		approvals: SandboxRunApprovalRecord[];
		changed: boolean;
	} {
		return applyApprovalLifecycleTransitions(approvals);
	}

	private async getApprovalsWithLifecycle(): Promise<
		SandboxRunApprovalRecord[]
	> {
		const approvals = await this.getApprovals();
		const transitioned = this.applyApprovalLifecycleTransitions(approvals);
		if (transitioned.changed) {
			await this.putApprovals(transitioned.approvals);
		}
		return transitioned.approvals;
	}

	public async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const pathname = url.pathname;

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

		if (pathname === "/approval/request" && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			const command =
				typeof body.command === "string" ? body.command.trim() : "";
			if (!command) {
				return Response.json({ error: "command is required" }, { status: 400 });
			}

			const approvals = await this.getApprovalsWithLifecycle();
			const control = await this.getControl();
			const approval = buildApprovalRecord({
				runId: control?.runId ?? "unknown",
				command,
				body,
			});
			approvals.push(approval);
			await this.putApprovals(approvals);
			return Response.json({ approval });
		}

		if (pathname === "/approval/resolve" && request.method === "POST") {
			const body = (await request.json()) as Record<string, unknown>;
			const id = typeof body.id === "string" ? body.id.trim() : "";
			const status =
				body.status === "approved" || body.status === "rejected"
					? body.status
					: undefined;
			if (!id || !status) {
				return Response.json(
					{ error: "id and status are required" },
					{ status: 400 },
				);
			}

			const approvals = await this.getApprovalsWithLifecycle();
			const approval = approvals.find((entry) => entry.id === id);
			if (!approval) {
				return Response.json({ error: "Approval not found" }, { status: 404 });
			}
			if (approval.status === "timed_out") {
				return Response.json(
					{ error: "Approval already timed out" },
					{ status: 409 },
				);
			}
			if (approval.status === "approved" || approval.status === "rejected") {
				return Response.json(
					{ error: "Approval already resolved" },
					{ status: 409 },
				);
			}

			const resolvedAt = new Date().toISOString();
			const nextApprovals: SandboxRunApprovalRecord[] = approvals.map(
				(entry) =>
					entry.id === id
						? {
								...entry,
								status,
								resolvedAt,
								resolutionReason:
									typeof body.reason === "string"
										? body.reason
										: entry.resolutionReason,
							}
						: entry,
			);
			await this.putApprovals(nextApprovals);
			const updated = nextApprovals.find((entry) => entry.id === id);
			return Response.json({ success: true, approval: updated });
		}

		if (pathname.startsWith("/approval/") && request.method === "GET") {
			const approvalId = pathname.slice("/approval/".length).trim();
			if (!approvalId) {
				return Response.json(
					{ error: "approvalId is required" },
					{ status: 400 },
				);
			}
			const approvals = await this.getApprovalsWithLifecycle();
			const approval = approvals.find((entry) => entry.id === approvalId);
			if (!approval) {
				return Response.json({ error: "Approval not found" }, { status: 404 });
			}
			return Response.json({ approval });
		}

		if (pathname === "/approval" && request.method === "GET") {
			const approvals = await this.getApprovalsWithLifecycle();
			return Response.json({ approvals });
		}

		return Response.json({ error: "Not found" }, { status: 404 });
	}
}
