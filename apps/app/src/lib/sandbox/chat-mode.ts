import type { SandboxTaskType } from "~/types/sandbox";

export const SANDBOX_MODE_TOOL_NAMES = [
	"run_feature_implementation",
	"run_code_review",
	"run_test_suite",
	"run_bug_fix",
	"run_refactoring",
	"run_documentation",
	"run_migration",
] as const;

export const SANDBOX_TASK_TYPE_TOOL_MAP = {
	"feature-implementation": "run_feature_implementation",
	"code-review": "run_code_review",
	"test-suite": "run_test_suite",
	"bug-fix": "run_bug_fix",
	refactoring: "run_refactoring",
	documentation: "run_documentation",
	migration: "run_migration",
} as const satisfies Record<SandboxTaskType, (typeof SANDBOX_MODE_TOOL_NAMES)[number]>;

export function getSandboxModeToolNames(taskType?: SandboxTaskType): string[] {
	return taskType ? [SANDBOX_TASK_TYPE_TOOL_MAP[taskType]] : [...SANDBOX_MODE_TOOL_NAMES];
}
