import { toast } from "sonner";

import {
	SANDBOX_TASK_TYPES,
	type SandboxRun,
	type SandboxRunEvent,
	type SandboxRunInstruction,
	type SandboxTaskType,
} from "~/types/sandbox";

import type {
	ApprovalInstructionItem,
	ApprovalStatus,
	ChatMessage,
	TimelineEvent,
} from "./types";

export function parseSandboxTaskType(
	value: string,
	fallback: SandboxTaskType = "feature-implementation",
): SandboxTaskType {
	return SANDBOX_TASK_TYPES.includes(value as SandboxTaskType)
		? (value as SandboxTaskType)
		: fallback;
}

export function summariseRunResult(run: SandboxRun): string {
	if (run.result?.summary && typeof run.result.summary === "string") {
		return run.result.summary;
	}
	if (typeof run.result?.error === "string") {
		return run.result.error;
	}
	if (run.status === "completed") {
		return "Run completed.";
	}
	if (run.status === "failed") {
		return run.error || "Run failed.";
	}
	if (run.status === "cancelled") {
		return run.cancellationReason || "Run cancelled.";
	}
	if (run.status === "paused") {
		return run.pauseReason || "Run paused.";
	}
	return "Run in progress.";
}

export async function copyToClipboard(text: string, label: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	} catch {
		toast.error("Failed to copy to clipboard");
	}
}

export function buildTimelineFromRun(run: SandboxRun): TimelineEvent[] {
	return run.events.map((event, index) => ({
		id: `${run.runId}-event-${index}`,
		receivedAt:
			typeof event.timestamp === "string" ? event.timestamp : run.updatedAt,
		event,
	}));
}

export function getAssistantMessageFromEvent(
	event: SandboxRunEvent,
): string | null {
	if (event.type === "run_completed") {
		return typeof event.result?.summary === "string"
			? event.result.summary
			: "Sandbox run completed.";
	}

	if (event.type === "run_failed") {
		return event.error || "Sandbox run failed.";
	}

	if (event.type === "run_cancelled") {
		return event.message || event.error || "Sandbox run cancelled.";
	}

	if (event.type === "command_approval_requested") {
		return (
			event.message ||
			`Approval requested for command: ${event.command ?? "unknown command"}`
		);
	}

	if (event.type === "command_approval_escalated") {
		return (
			event.message ||
			`Approval escalated for command: ${event.command ?? "unknown command"}`
		);
	}

	if (event.type === "command_approval_timed_out") {
		return (
			event.message ||
			`Approval timed out for command: ${event.command ?? "unknown command"}`
		);
	}

	if (event.type === "run_instruction_received") {
		return (
			event.message ||
			(event.instructionKind === "continue"
				? "Worker received continue instruction."
				: "Worker received operator message.")
		);
	}

	if (event.type === "run_instruction_submitted") {
		return (
			event.message ||
			(event.instructionKind === "continue"
				? "Continue instruction submitted."
				: "Operator instruction submitted.")
		);
	}

	return null;
}

export function buildMessagesFromRun(run: SandboxRun): ChatMessage[] {
	const messages: ChatMessage[] = [
		{
			id: `${run.runId}-user`,
			role: "user",
			content: run.task,
			createdAt: run.startedAt,
		},
	];

	for (const event of run.events) {
		const content = getAssistantMessageFromEvent(event);
		if (!content) {
			continue;
		}
		messages.push({
			id: `${run.runId}-assistant-${messages.length}`,
			role: "assistant",
			content,
			createdAt:
				typeof event.timestamp === "string" ? event.timestamp : run.updatedAt,
		});
	}

	if (messages.length === 1) {
		if (
			run.status === "completed" ||
			run.status === "failed" ||
			run.status === "cancelled" ||
			run.status === "paused"
		) {
			messages.push({
				id: `${run.runId}-assistant`,
				role: "assistant",
				content: summariseRunResult(run),
				createdAt: run.completedAt ?? run.updatedAt,
			});
		}
	}

	return messages;
}

export function getLatestPlanEvent(
	timeline: TimelineEvent[],
): { plan: string; updatedAt: string } | null {
	for (let index = timeline.length - 1; index >= 0; index -= 1) {
		const entry = timeline[index];
		if (
			(entry.event.type === "planning_completed" ||
				entry.event.type === "plan_updated") &&
			typeof entry.event.plan === "string" &&
			entry.event.plan.trim()
		) {
			return {
				plan: entry.event.plan,
				updatedAt: entry.receivedAt,
			};
		}
	}
	return null;
}

export function extractPlanTasks(plan: string): string[] {
	const tasks = plan
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => Boolean(line))
		.map((line) =>
			line
				.replace(/^[-*+]\s+/, "")
				.replace(/^\d+[.)]\s+/, "")
				.replace(/^#{1,6}\s+/, "")
				.trim(),
		)
		.filter((line) => line.length > 3 && !line.endsWith(":"));

	return tasks.slice(0, 12);
}

export function getEventDetailLines(event: SandboxRunEvent): string[] {
	const lines: string[] = [];
	if (typeof event.reasoning === "string" && event.reasoning.trim()) {
		lines.push(`Reasoning: ${event.reasoning}`);
	}
	if (typeof event.command === "string" && event.command.trim()) {
		lines.push(`Command: ${event.command}`);
	}
	if (typeof event.path === "string" && event.path.trim()) {
		const lineRange =
			typeof event.startLine === "number" || typeof event.endLine === "number"
				? ` (${event.startLine ?? "?"}-${event.endLine ?? "?"})`
				: "";
		lines.push(`Path: ${event.path}${lineRange}`);
	}
	if (typeof event.plan === "string" && event.plan.trim()) {
		lines.push(`Plan:\n${event.plan}`);
	}
	if (typeof event.error === "string" && event.error.trim()) {
		lines.push(`Error: ${event.error}`);
	}
	if (typeof event.message === "string" && event.message.trim()) {
		lines.push(`Message: ${event.message}`);
	}
	if (
		typeof event.instructionContent === "string" &&
		event.instructionContent.trim()
	) {
		lines.push(`Instruction: ${event.instructionContent}`);
	}
	return lines;
}

export function toApprovalInstructionItems(
	instructions: SandboxRunInstruction[],
): ApprovalInstructionItem[] {
	return instructions
		.filter(
			(instruction) =>
				instruction.kind === "approval_request" &&
				typeof instruction.command === "string" &&
				instruction.command.trim().length > 0,
		)
		.map((instruction) => ({
			id: instruction.id,
			command: instruction.command ?? "",
			status: (instruction.approvalStatus ?? "pending") as ApprovalStatus,
			requestedAt: instruction.createdAt,
			expiresAt: instruction.expiresAt,
			escalatedAt: instruction.escalatedAt,
			timedOutAt: instruction.timedOutAt,
			resolutionReason: instruction.resolutionReason,
		}));
}

export function getApprovalStatusBadgeVariant(
	status: ApprovalStatus,
): "outline" | "secondary" | "destructive" {
	switch (status) {
		case "approved":
			return "outline";
		case "rejected":
		case "timed_out":
			return "destructive";
		default:
			return "secondary";
	}
}

export function isApprovalPendingStatus(status: ApprovalStatus): boolean {
	return status === "pending" || status === "escalated";
}

export function isRunStatusActive(
	status: SandboxRun["status"] | undefined,
): boolean {
	return status === "queued" || status === "running";
}
