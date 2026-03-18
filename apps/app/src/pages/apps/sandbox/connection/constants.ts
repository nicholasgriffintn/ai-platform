import type { SandboxTaskType } from "~/types/sandbox";

export const SANDBOX_TASK_TYPE_LABELS: Record<SandboxTaskType, string> = {
	"feature-implementation": "Feature implementation",
	"code-review": "Code review",
	"test-suite": "Test suite",
	"bug-fix": "Bug fix",
	refactoring: "Refactoring",
	documentation: "Documentation",
	migration: "Migration",
};

export const SANDBOX_TASK_TYPE_DESCRIPTIONS: Record<SandboxTaskType, string> = {
	"feature-implementation":
		"Implement the requested feature and make code changes where required.",
	"code-review":
		"Perform a read-only code review focused on correctness, security, and test gaps.",
	"test-suite":
		"Run and analyse relevant test suites without modifying repository files.",
	"bug-fix":
		"Diagnose and fix a specific bug with targeted, maintainable changes.",
	refactoring:
		"Refactor existing code for maintainability while preserving behaviour.",
	documentation:
		"Create or update project documentation to reflect current implementation details.",
	migration:
		"Apply dependency or framework migrations with explicit validation and rollback awareness.",
};
