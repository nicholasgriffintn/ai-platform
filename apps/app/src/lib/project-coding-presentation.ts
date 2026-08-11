import type { SandboxTaskType } from "@assistant/schemas";

import type { Question } from "~/types/sampleQuestions";

export interface ProjectCodingPresentation {
	title: string;
	description: string;
	placeholder: string;
	sampleQuestions: Question[];
}

const presentations: Record<SandboxTaskType, ProjectCodingPresentation> = {
	"feature-implementation": {
		title: "What should we build?",
		description: "Describe a change for the project repository.",
		placeholder: "Describe the feature you want to build…",
		sampleQuestions: [
			question(
				"feature-implementation-1",
				"Implement a focused feature",
				"Implement a focused feature in the project repository.",
			),
			question(
				"feature-implementation-2",
				"Add an API endpoint",
				"Add an API endpoint for the project and cover it with tests.",
			),
			question(
				"feature-implementation-3",
				"Improve an existing workflow",
				"Improve an existing workflow without changing its public behaviour.",
			),
			question(
				"feature-implementation-4",
				"Build a small UI change",
				"Build a small UI change that fits the existing application style.",
			),
		],
	},
	"bug-fix": {
		title: "What should we fix?",
		description: "Describe the bug and the behaviour you expect instead.",
		placeholder: "Describe the bug, expected behaviour, and useful repro steps…",
		sampleQuestions: [
			question(
				"bug-fix-1",
				"Diagnose and fix a bug",
				"Diagnose and fix the reported bug, then add a regression test.",
			),
			question(
				"bug-fix-2",
				"Track down a failing test",
				"Find the cause of the failing test and fix the underlying issue.",
			),
			question(
				"bug-fix-3",
				"Fix an edge case",
				"Fix this edge case without changing the normal behaviour.",
			),
			question(
				"bug-fix-4",
				"Investigate an error",
				"Investigate this error from the relevant code path and propose the smallest safe fix.",
			),
		],
	},
	"code-review": {
		title: "What should we review?",
		description: "Point the review at a change, path, or concern in the repository.",
		placeholder: "Describe the change or code you want reviewed…",
		sampleQuestions: [
			question(
				"code-review-1",
				"Review a risky change",
				"Review the risky change for correctness, regressions, and security issues.",
			),
			question(
				"code-review-2",
				"Check the error handling",
				"Review the error handling in this area and identify missing failure paths.",
			),
			question(
				"code-review-3",
				"Look for regressions",
				"Look for regressions introduced by the latest changes.",
			),
			question(
				"code-review-4",
				"Review the test coverage",
				"Review whether the tests cover the important behaviour and edge cases.",
			),
		],
	},
	"test-suite": {
		title: "What should we test?",
		description: "Describe the behaviour that needs coverage in the project repository.",
		placeholder: "Describe the behaviour that needs tests…",
		sampleQuestions: [
			question(
				"test-suite-1",
				"Add regression coverage",
				"Add regression coverage for the reported issue.",
			),
			question(
				"test-suite-2",
				"Cover the error path",
				"Add tests for the validation and error paths in this feature.",
			),
			question(
				"test-suite-3",
				"Test the integration",
				"Add an integration test for this end-to-end behaviour.",
			),
			question(
				"test-suite-4",
				"Improve weak coverage",
				"Find the most important missing test coverage and add it.",
			),
		],
	},
	refactoring: {
		title: "What should we refactor?",
		description: "Describe the structural improvement and constraints to preserve.",
		placeholder: "Describe the refactor and what must keep working…",
		sampleQuestions: [
			question(
				"refactoring-1",
				"Simplify a module",
				"Simplify this module while preserving its public behaviour.",
			),
			question(
				"refactoring-2",
				"Extract shared logic",
				"Extract the shared logic into a reusable module and update its callers.",
			),
			question(
				"refactoring-3",
				"Reduce duplication",
				"Reduce duplication in this area without introducing speculative abstractions.",
			),
			question(
				"refactoring-4",
				"Improve the boundary",
				"Improve the boundary between this route and its feature logic.",
			),
		],
	},
	documentation: {
		title: "What should we document?",
		description: "Describe the code, workflow, or decision that needs clear documentation.",
		placeholder: "Describe what needs documenting…",
		sampleQuestions: [
			question(
				"documentation-1",
				"Document the setup",
				"Document the setup and validation steps for this project.",
			),
			question(
				"documentation-2",
				"Explain the workflow",
				"Explain the workflow a new contributor needs to understand.",
			),
			question(
				"documentation-3",
				"Record an architecture decision",
				"Record the architecture decision behind this implementation.",
			),
			question(
				"documentation-4",
				"Update stale docs",
				"Find and update documentation that no longer matches the code.",
			),
		],
	},
	migration: {
		title: "What should we migrate?",
		description: "Describe the migration, affected data, and compatibility constraints.",
		placeholder: "Describe the migration and its constraints…",
		sampleQuestions: [
			question(
				"migration-1",
				"Plan a safe migration",
				"Plan and implement a safe migration for this schema change.",
			),
			question(
				"migration-2",
				"Update the data shape",
				"Update the data shape and all affected consumers.",
			),
			question(
				"migration-3",
				"Add migration coverage",
				"Add coverage for the migration and its failure cases.",
			),
			question(
				"migration-4",
				"Remove an old path",
				"Remove the old path as part of this migration without a compatibility layer.",
			),
		],
	},
};

function question(id: string, text: string, prompt: string): Question {
	return { id, text, question: prompt, category: "coding" };
}

export function getProjectCodingPresentation(taskType: SandboxTaskType): ProjectCodingPresentation {
	return presentations[taskType];
}
