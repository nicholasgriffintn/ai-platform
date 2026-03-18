import type { SandboxRunEvent } from "~/types/sandbox";

export interface TimelineEvent {
	id: string;
	receivedAt: string;
	event: SandboxRunEvent;
}

export interface ChatMessage {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: string;
}

export type ApprovalStatus =
	| "pending"
	| "escalated"
	| "timed_out"
	| "approved"
	| "rejected";

export interface ApprovalInstructionItem {
	id: string;
	command: string;
	status: ApprovalStatus;
	requestedAt: string;
	expiresAt?: string;
	escalatedAt?: string;
	timedOutAt?: string;
	resolutionReason?: string;
}
