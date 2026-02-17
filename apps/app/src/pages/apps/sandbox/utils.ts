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
		case "plan_updated":
			return "Plan updated during execution";
		case "agent_step_started":
			return `Agent step ${event.agentStep ?? "?"} started`;
		case "agent_decision":
			return `Agent action: ${event.action ?? "unknown"}`;
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
		case "run_failed":
			return `Run failed: ${event.error ?? "Unknown error"}`;
		default:
			return event.message || event.type;
	}
}
