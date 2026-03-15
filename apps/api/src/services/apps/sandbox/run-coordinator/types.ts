import type { SandboxRunControl, SandboxRunEvent } from "@assistant/schemas";

export type CoordinatorState = SandboxRunControl;

export interface CoordinatorEventEnvelope {
	index: number;
	event: SandboxRunEvent;
	recordedAt: string;
}

export interface SandboxRunApprovalRecord {
	id: string;
	runId: string;
	command: string;
	status: "pending" | "approved" | "rejected";
	requestedAt: string;
	resolvedAt?: string;
	resolutionReason?: string;
	requestReason?: string;
}
