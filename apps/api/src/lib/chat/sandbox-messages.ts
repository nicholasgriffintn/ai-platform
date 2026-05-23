import type { SandboxRunEvent, SandboxRunResult, SandboxTaskType } from "@assistant/schemas";

import { ResponseDisplayType } from "~/types/functions";
import type { IFunctionResponse } from "~/types";

interface SandboxRunSummary {
	runId: string;
	repo: string;
	task: string;
	taskType?: SandboxTaskType;
	model?: string;
	status: string;
	startedAt?: string;
	updatedAt?: string;
	completedAt?: string;
	error?: string;
	result?: SandboxRunResult;
}

export function describeSandboxEvent(event: SandboxRunEvent): string {
	switch (event.type) {
		case "run_started":
			return "Run started";
		case "repo_context_collected":
			return event.message || "Repository context collected";
		case "planning_started":
			return "Generating implementation plan";
		case "planning_completed":
			return "Plan generated";
		case "prompt_strategy_selected":
			return event.promptStrategy
				? `Prompt strategy selected: ${event.promptStrategy}`
				: event.message || "Prompt strategy selected";
		case "plan_updated":
			return "Plan updated during execution";
		case "agent_step_started":
			return `Agent step ${event.agentStep ?? "?"} started`;
		case "agent_decision":
			return `Agent action: ${event.action ?? "unknown"}${event.reasoning ? ` (${event.reasoning})` : ""}`;
		case "agent_decision_invalid":
			return event.error ? `Agent decision invalid: ${event.error}` : "Agent decision invalid";
		case "agent_repetition_detected":
			return event.message || "Repeated action detected; forcing replanning";
		case "agent_step_budget_extended":
			return `Step budget extended by ${event.extendedBy ?? "?"} (new max ${event.maxSteps ?? "?"})`;
		case "agent_step_budget_exhausted":
			return event.error || "Agent step budget exhausted";
		case "file_read":
			return `Read ${event.path ?? "file"}${event.error ? ` (failed: ${event.error})` : ""}`;
		case "agent_finished":
			return "Agent marked execution complete";
		case "task_failed":
			return `Task failed: ${event.error ?? "Unknown error"}`;
		case "task_cancelled":
			return event.error || "Task cancelled";
		case "command_batch_ready":
			return `Prepared ${event.commandTotal ?? "?"} commands`;
		case "command_started":
			return `Running command ${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"}: ${event.command ?? ""}`;
		case "command_output":
			return `${event.stream ?? "output"}: ${event.output ?? ""}`.trim();
		case "command_completed":
			return `Completed command ${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"}`;
		case "command_failed":
			return `Command failed: ${event.command ?? "unknown command"}`;
		case "command_approval_requested":
			return `Approval requested for command: ${event.command ?? "unknown command"}`;
		case "command_approval_escalated":
			return `Approval escalated for command: ${event.command ?? "unknown command"}`;
		case "command_approval_timed_out":
			return `Approval timed out for command: ${event.command ?? "unknown command"}`;
		case "command_approval_resolved":
			return `Approval ${event.approvalStatus ?? "resolved"} for command: ${event.command ?? "unknown command"}`;
		case "repo_clone_started":
			return "Cloning repository";
		case "repo_clone_completed":
			return "Repository cloned";
		case "git_branch_created":
			return `Created branch ${event.branchName ?? ""}`.trim();
		case "diff_generated":
			return "Generated code diff";
		case "commit_created":
			return `Created commit on ${event.branchName ?? "feature branch"}`;
		case "run_completed":
			return "Run completed successfully";
		case "run_cancelled":
			return event.message || "Run cancelled";
		case "run_paused":
			return event.message || "Run paused";
		case "run_resumed":
			return event.message || "Run resumed";
		case "run_failed":
			return `Run failed: ${event.error ?? "Unknown error"}`;
		case "file_changed":
			return `File ${event.changeType ?? "changed"}: ${event.path ?? "unknown"}`;
		case "script_started":
			return `Running ${event.language ?? "script"} (${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"})`;
		case "script_completed":
			return `Script completed (${event.commandIndex ?? "?"}/${event.commandTotal ?? "?"})`;
		case "script_failed":
			return `Script failed: ${event.error ?? "unknown error"}`;
		case "quality_gate_output":
			return `${event.stream ?? "quality gate output"}: ${event.output ?? ""}`.trim();
		case "run_instruction_submitted":
			return event.instructionKind === "continue"
				? "Continue instruction sent"
				: "Operator instruction sent";
		case "run_instruction_received":
			return event.instructionKind === "continue"
				? "Worker received continue instruction"
				: "Worker received operator message";
		default:
			return event.message || event.type;
	}
}

export function summariseSandboxRunResult(
	run: Pick<SandboxRunSummary, "status" | "result" | "error">,
) {
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
		return run.error || "Run cancelled.";
	}
	return "Run in progress.";
}

export function buildSandboxPlanToolResponse(params: {
	runId?: string;
	event: SandboxRunEvent;
}): IFunctionResponse | null {
	const plan = typeof params.event.plan === "string" ? params.event.plan.trim() : "";
	if (!plan) {
		return null;
	}

	const updatedAt = params.event.timestamp ?? new Date().toISOString();
	return {
		role: "tool",
		name: "sandbox_plan",
		status: "success",
		content: "Sandbox plan updated",
		data: {
			formattedName: "Sandbox plan",
			responseType: ResponseDisplayType.CUSTOM,
			modelContext: false,
			result: {
				name: "sandbox_plan",
				data: {
					runId: params.runId ?? params.event.runId,
					plan,
					updatedAt,
				},
			},
		},
	};
}

export function buildSandboxEventToolResponse(event: SandboxRunEvent): IFunctionResponse {
	const receivedAt = event.timestamp ?? new Date().toISOString();
	return {
		role: "tool",
		name: "sandbox_event",
		status: event.type,
		content: describeSandboxEvent(event),
		data: {
			formattedName: formatSandboxEventName(event.type),
			responseType: ResponseDisplayType.CUSTOM,
			modelContext: false,
			result: {
				name: "sandbox_event",
				data: {
					type: event.type,
					description: describeSandboxEvent(event),
					receivedAt,
					details: getSandboxEventDetailLines(event),
					event,
				},
			},
		},
	};
}

export function buildSandboxResultToolResponse(run: SandboxRunSummary): IFunctionResponse {
	return {
		role: "tool",
		status: run.status,
		content: summariseSandboxRunResult(run),
		data: {
			formattedName: "Sandbox result",
			responseType: ResponseDisplayType.CUSTOM,
			result: {
				name: "sandbox_result",
				data: {
					runId: run.runId,
					repo: run.repo,
					task: run.task,
					taskType: run.taskType,
					model: run.model,
					status: run.status,
					startedAt: run.startedAt,
					updatedAt: run.updatedAt,
					completedAt: run.completedAt,
					summary: summariseSandboxRunResult(run),
					error: run.error,
					result: run.result,
				},
			},
		},
	};
}

function getSandboxEventDetailLines(event: SandboxRunEvent): string[] {
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
	if (typeof event.instructionContent === "string" && event.instructionContent.trim()) {
		lines.push(`Instruction: ${event.instructionContent}`);
	}
	return lines;
}

function formatSandboxEventName(type: string): string {
	return type
		.split("_")
		.filter(Boolean)
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
}
