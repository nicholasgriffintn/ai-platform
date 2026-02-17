import { describe, expect, it } from "vitest";

import { buildPlanningPrompt } from "../feature-implementation/prompts";
import { resolvePromptStrategy } from "../feature-implementation/prompt-strategy";
import type { RepositoryContext } from "../feature-implementation/types";

const baseRepositoryContext: RepositoryContext = {
	topLevelEntries: ["README.md", "apps", "packages"],
	files: [
		{
			path: "README.md",
			snippet: "# Demo repository\n\nThis is a demo.",
		},
	],
	taskInstructionSource: "none",
};

describe("feature prompt strategies", () => {
	it("uses explicit prompt strategy when provided", () => {
		const selected = resolvePromptStrategy({
			requestedStrategy: "refactor",
			taskType: "feature-implementation",
			task: "Refactor duplicated helpers",
		});

		expect(selected.strategy).toBe("refactor");
		expect(selected.source).toBe("explicit");
	});

	it("detects bug-fix strategy from task keywords in auto mode", () => {
		const selected = resolvePromptStrategy({
			requestedStrategy: "auto",
			taskType: "feature-implementation",
			task: "Fix regression in sandbox run cancellation flow",
		});

		expect(selected.strategy).toBe("bug-fix");
		expect(selected.source).toBe("task-keywords");
	});

	it("falls back to task-type defaults when no keyword match exists", () => {
		const selected = resolvePromptStrategy({
			requestedStrategy: "auto",
			taskType: "code-review",
			task: "Review recent changes for quality",
		});

		expect(selected.strategy).toBe("test-hardening");
		expect(selected.source).toBe("task-type");
	});

	it("injects strategy focus and examples into planning prompt", () => {
		const strategy = resolvePromptStrategy({
			requestedStrategy: "feature-delivery",
			taskType: "feature-implementation",
			task: "Add a new settings panel",
		});

		const prompt = buildPlanningPrompt({
			repoName: "owner/repo",
			task: "Add a new settings panel",
			repoContext: baseRepositoryContext,
			promptStrategy: strategy,
		});

		expect(prompt).toContain("Selected prompt strategy");
		expect(prompt).toContain("Good implementation examples to emulate");
		expect(prompt).toContain("Example 1:");
	});
});
