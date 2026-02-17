import type {
	SandboxPromptStrategy,
	SandboxTaskType,
} from "@assistant/schemas";

type ResolvedPromptStrategy = Exclude<SandboxPromptStrategy, "auto">;

interface PromptExample {
	title: string;
	situation: string;
	approach: string[];
	validation: string[];
}

export interface PromptStrategyDefinition {
	strategy: ResolvedPromptStrategy;
	label: string;
	planningFocus: string[];
	executionFocus: string[];
	examples: PromptExample[];
}

export interface PromptStrategySelection {
	strategy: ResolvedPromptStrategy;
	definition: PromptStrategyDefinition;
	reason: string;
	source: "explicit" | "task-type" | "task-keywords";
}

const STRATEGY_DEFINITIONS: Record<
	ResolvedPromptStrategy,
	PromptStrategyDefinition
> = {
	"feature-delivery": {
		strategy: "feature-delivery",
		label: "Feature delivery",
		planningFocus: [
			"Prioritise end-to-end behaviour before internal refactors.",
			"Reuse existing modules and patterns unless there is a strong reason to diverge.",
			"List state, validation, and user-facing edge cases in the plan.",
		],
		executionFocus: [
			"Implement in small, verifiable steps and keep interfaces stable.",
			"Prefer extending existing services/components over introducing new abstraction layers.",
			"Validate behaviour with targeted tests or checks before finishing.",
		],
		examples: [
			{
				title: "Ship a new user-facing capability",
				situation: "Adding a new action in an existing product flow.",
				approach: [
					"Trace the full flow from input to persistence and response rendering.",
					"Update API contracts and UI handling together to avoid drift.",
					"Reuse existing validators/utilities for payload parsing and error shapes.",
				],
				validation: [
					"Run integration checks for the full happy path.",
					"Add failure-path coverage for validation and permission errors.",
				],
			},
			{
				title: "Extend an existing workflow safely",
				situation: "Enhancing behaviour without breaking existing callers.",
				approach: [
					"Keep existing function signatures stable where possible.",
					"Gate new behaviour behind explicit branching with clear defaults.",
					"Refactor duplicated logic only when needed by the new flow.",
				],
				validation: [
					"Verify existing tests still pass.",
					"Add targeted checks for the new branch and fallback path.",
				],
			},
		],
	},
	"bug-fix": {
		strategy: "bug-fix",
		label: "Bug fix",
		planningFocus: [
			"Reproduce the failure first and record concrete signals of the bug.",
			"Identify the narrowest safe fix that resolves the root cause.",
			"Include explicit regression validation in plan commands.",
		],
		executionFocus: [
			"Avoid broad rewrites unless root-cause analysis proves they are required.",
			"Preserve existing behaviour outside the failing scenario.",
			"Add regression coverage for the exact failure mode.",
		],
		examples: [
			{
				title: "Fix a runtime failure",
				situation:
					"A request fails due to missing guardrails on input handling.",
				approach: [
					"Add missing validation close to the input boundary.",
					"Return consistent typed errors instead of throwing generic exceptions.",
					"Keep downstream services unchanged unless they contribute to the bug.",
				],
				validation: [
					"Run the failing scenario before and after the change.",
					"Add a regression test that would fail without the fix.",
				],
			},
			{
				title: "Resolve a behavioural regression",
				situation: "Recent change altered expected state transitions.",
				approach: [
					"Compare current vs expected transition logic with small diffs.",
					"Restore invariants at the state boundary, not at every call site.",
					"Document assumptions in the updated plan to prevent repeat regressions.",
				],
				validation: [
					"Validate both regression case and unaffected adjacent states.",
					"Run targeted tests to prove old behaviour remains intact.",
				],
			},
		],
	},
	refactor: {
		strategy: "refactor",
		label: "Refactor",
		planningFocus: [
			"Define clear maintainability goals before changing structure.",
			"Prefer incremental refactors with preserved behaviour at each step.",
			"Use existing shared utilities before adding new helper layers.",
		],
		executionFocus: [
			"Keep business behaviour unchanged while reducing duplication and complexity.",
			"Extract shared logic only when at least two call sites benefit immediately.",
			"Retain public contracts unless task explicitly allows API changes.",
		],
		examples: [
			{
				title: "Reduce duplicated backend logic",
				situation:
					"Multiple services repeat the same parsing and validation flow.",
				approach: [
					"Create one focused shared utility with clear input/output typing.",
					"Migrate one call site at a time and run checks between changes.",
					"Delete dead branches after migration to avoid parallel code paths.",
				],
				validation: [
					"Run integration tests for all migrated call sites.",
					"Check that logging and error payloads remain consistent.",
				],
			},
			{
				title: "Refactor UI flow for readability",
				situation: "Single component has too much conditional rendering logic.",
				approach: [
					"Extract stable subcomponents aligned to explicit view states.",
					"Keep state management in the parent unless shared state is needed.",
					"Reuse existing UI primitives and class naming conventions.",
				],
				validation: [
					"Verify each view state renders correctly.",
					"Run existing UI tests and add one for the split state boundary.",
				],
			},
		],
	},
	"test-hardening": {
		strategy: "test-hardening",
		label: "Test hardening",
		planningFocus: [
			"Focus on integration-style coverage for validation, state, and error handling.",
			"Prefer high-signal tests over broad low-value unit assertions.",
			"Map each new test to a concrete risk or requirement.",
		],
		executionFocus: [
			"Test externally visible behaviour, not implementation details.",
			"Cover edge cases and failure paths that would impact users or data integrity.",
			"Keep test fixtures minimal and representative.",
		],
		examples: [
			{
				title: "Add coverage for a stateful API path",
				situation: "Endpoint has weak validation and sparse error-path tests.",
				approach: [
					"Write integration tests around realistic request/response flows.",
					"Assert status codes and response payload semantics.",
					"Include invalid input and permission-denied cases.",
				],
				validation: [
					"Run focused test suite and verify failure messages are clear.",
					"Confirm no unrelated tests became flaky after fixture updates.",
				],
			},
			{
				title: "Harden long-running workflow tests",
				situation:
					"Workflow passes happy path but fails silently on intermediate errors.",
				approach: [
					"Add tests per transition step with explicit failure assertions.",
					"Stub external dependencies at stable boundaries only.",
					"Keep setup reusable through existing test helpers.",
				],
				validation: [
					"Run the workflow suite with deterministic inputs.",
					"Verify error handling paths produce expected recovery or fail-fast behaviour.",
				],
			},
		],
	},
};

const TASK_TYPE_DEFAULT_STRATEGY: Record<
	SandboxTaskType,
	ResolvedPromptStrategy
> = {
	"feature-implementation": "feature-delivery",
	"code-review": "test-hardening",
	"test-suite": "test-hardening",
	"bug-fix": "bug-fix",
	refactoring: "refactor",
	documentation: "feature-delivery",
	migration: "refactor",
};

const TASK_KEYWORD_STRATEGY_RULES: Array<{
	pattern: RegExp;
	strategy: ResolvedPromptStrategy;
	reason: string;
}> = [
	{
		pattern:
			/\b(bug|fix|broken|regression|error|defect|crash|failing|hotfix)\b/i,
		strategy: "bug-fix",
		reason: "Task text indicates bug-fixing work.",
	},
	{
		pattern: /\b(refactor|cleanup|restructure|rename|debt|simplify)\b/i,
		strategy: "refactor",
		reason: "Task text indicates maintainability-focused refactoring.",
	},
	{
		pattern:
			/\b(test|coverage|spec|assertion|integration test|regression test)\b/i,
		strategy: "test-hardening",
		reason: "Task text indicates testing and verification focus.",
	},
];

function isResolvedPromptStrategy(
	value: string,
): value is ResolvedPromptStrategy {
	return value in STRATEGY_DEFINITIONS;
}

function fromTaskKeywords(task: string): PromptStrategySelection | null {
	const trimmedTask = task.trim();
	if (!trimmedTask) {
		return null;
	}

	for (const rule of TASK_KEYWORD_STRATEGY_RULES) {
		if (!rule.pattern.test(trimmedTask)) {
			continue;
		}

		const definition = STRATEGY_DEFINITIONS[rule.strategy];
		return {
			strategy: rule.strategy,
			definition,
			reason: rule.reason,
			source: "task-keywords",
		};
	}

	return null;
}

export function resolvePromptStrategy(params: {
	requestedStrategy?: SandboxPromptStrategy;
	taskType: SandboxTaskType;
	task: string;
}): PromptStrategySelection {
	const { requestedStrategy, taskType, task } = params;
	if (requestedStrategy && requestedStrategy !== "auto") {
		if (isResolvedPromptStrategy(requestedStrategy)) {
			return {
				strategy: requestedStrategy,
				definition: STRATEGY_DEFINITIONS[requestedStrategy],
				reason: `Using explicit strategy '${requestedStrategy}'.`,
				source: "explicit",
			};
		}
	}

	const byKeywords = fromTaskKeywords(task);
	if (byKeywords) {
		return byKeywords;
	}

	const defaultStrategy = TASK_TYPE_DEFAULT_STRATEGY[taskType];
	return {
		strategy: defaultStrategy,
		definition: STRATEGY_DEFINITIONS[defaultStrategy],
		reason: `Using default strategy for task type '${taskType}'.`,
		source: "task-type",
	};
}

export function formatPromptStrategyFocus(
	definition: PromptStrategyDefinition,
	type: "planning" | "execution",
): string {
	const entries =
		type === "planning" ? definition.planningFocus : definition.executionFocus;
	return entries.map((entry) => `- ${entry}`).join("\n");
}

export function formatPromptStrategyExamples(
	definition: PromptStrategyDefinition,
): string {
	return definition.examples
		.map((example, index) =>
			[
				`Example ${index + 1}: ${example.title}`,
				`Situation: ${example.situation}`,
				"Approach:",
				...example.approach.map((entry) => `- ${entry}`),
				"Validation:",
				...example.validation.map((entry) => `- ${entry}`),
			].join("\n"),
		)
		.join("\n\n");
}
