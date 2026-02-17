import type { SandboxTaskType } from "@assistant/schemas";

import type { TaskParams } from "../types";

export interface ResolvedSandboxTaskProfile {
	taskType: SandboxTaskType;
	task: string;
	shouldCommit: boolean;
	readOnlyCommands: boolean;
}

function buildCodeReviewTask(task: string): string {
	return [
		"Run a code review over the repository scope requested below.",
		"Focus on correctness, security, regressions, and missing tests.",
		"Do not modify files or create commits for this task.",
		`Review request: ${task}`,
	].join("\n");
}

function buildTestSuiteTask(task: string): string {
	return [
		"Run and analyse the relevant test suites for the repository.",
		"Prefer deterministic commands and report failing tests with root cause hypotheses.",
		"Do not modify files or create commits for this task.",
		`Test request: ${task}`,
	].join("\n");
}

function buildBugFixTask(task: string): string {
	return [
		"Diagnose and fix the bug described below.",
		"Prefer minimal, maintainable changes and update tests where needed.",
		`Bug report: ${task}`,
	].join("\n");
}

export function resolveSandboxTaskProfile(
	params: TaskParams,
): ResolvedSandboxTaskProfile {
	const taskType = params.taskType || "feature-implementation";
	const trimmedTask = params.task.trim();

	if (!trimmedTask) {
		throw new Error("Task is required");
	}

	switch (taskType) {
		case "code-review":
			return {
				taskType,
				task: buildCodeReviewTask(trimmedTask),
				shouldCommit: false,
				readOnlyCommands: true,
			};
		case "test-suite":
			return {
				taskType,
				task: buildTestSuiteTask(trimmedTask),
				shouldCommit: false,
				readOnlyCommands: true,
			};
		case "bug-fix":
			return {
				taskType,
				task: buildBugFixTask(trimmedTask),
				shouldCommit: Boolean(params.shouldCommit),
				readOnlyCommands: false,
			};
		case "feature-implementation":
		default:
			return {
				taskType: "feature-implementation",
				task: trimmedTask,
				shouldCommit: Boolean(params.shouldCommit),
				readOnlyCommands: false,
			};
	}
}
