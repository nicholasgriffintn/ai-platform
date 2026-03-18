import type { SandboxRunStatus, SandboxRunEvent } from "~/types/sandbox";
import { GITHUB_REPO_SLUG_PATTERN } from "~/lib/sandbox/repositories";

export const REPO_PATTERN = GITHUB_REPO_SLUG_PATTERN;
export const REPO_STORAGE_PREFIX = "sandbox:last-repo";

export const getStatusBadgeVariant = (
	status: SandboxRunStatus,
): "outline" | "secondary" | "destructive" => {
	const variants: Record<
		SandboxRunStatus,
		"outline" | "secondary" | "destructive"
	> = {
		completed: "outline",
		failed: "destructive",
		cancelled: "secondary",
		queued: "secondary",
		running: "secondary",
		paused: "secondary",
	};
	return variants[status];
};

export function describeEvent(event: SandboxRunEvent): string {
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
			return event.error
				? `Agent decision invalid: ${event.error}`
				: "Agent decision invalid";
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
