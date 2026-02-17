import {
	SANDBOX_PROMPT_STRATEGIES,
	type SandboxPromptStrategy,
} from "@assistant/schemas";

interface PromptStrategyOption {
	value: SandboxPromptStrategy;
	label: string;
	description: string;
}

const PROMPT_STRATEGY_LABELS: Record<SandboxPromptStrategy, string> = {
	auto: "Auto",
	"feature-delivery": "Feature Delivery",
	"bug-fix": "Bug Fix",
	refactor: "Refactor",
	"test-hardening": "Test Hardening",
};

const PROMPT_STRATEGY_DESCRIPTIONS: Record<SandboxPromptStrategy, string> = {
	auto: "Let the worker choose based on the task and repository context.",
	"feature-delivery": "Optimise for shipping user-facing functionality safely.",
	"bug-fix": "Focus on root-cause analysis and regression prevention.",
	refactor:
		"Prioritise maintainability improvements while preserving behaviour.",
	"test-hardening":
		"Focus on high-signal validation, state, and error-path coverage.",
};

export const sandboxPromptStrategyOptions: PromptStrategyOption[] =
	SANDBOX_PROMPT_STRATEGIES.map((strategy) => ({
		value: strategy,
		label: PROMPT_STRATEGY_LABELS[strategy],
		description: PROMPT_STRATEGY_DESCRIPTIONS[strategy],
	}));

export function getSandboxPromptStrategyLabel(
	strategy?: SandboxPromptStrategy,
): string {
	if (!strategy) {
		return PROMPT_STRATEGY_LABELS.auto;
	}
	return PROMPT_STRATEGY_LABELS[strategy] ?? strategy;
}

export function getSandboxPromptStrategyDescription(
	strategy: SandboxPromptStrategy,
): string {
	return PROMPT_STRATEGY_DESCRIPTIONS[strategy];
}

export function isSandboxPromptStrategy(
	value: string,
): value is SandboxPromptStrategy {
	for (const strategy of SANDBOX_PROMPT_STRATEGIES) {
		if (strategy === value) {
			return true;
		}
	}

	return false;
}

export function parseSandboxPromptStrategy(
	value: string,
	fallback: SandboxPromptStrategy = "auto",
): SandboxPromptStrategy {
	return isSandboxPromptStrategy(value) ? value : fallback;
}
