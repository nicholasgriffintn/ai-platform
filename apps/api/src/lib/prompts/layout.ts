import type { PromptCapabilities } from "./utils";

export type PromptExampleVariant = "full" | "compact" | "omit";
export type PromptMetadataFormat = "full" | "compact";
export type PromptInstructionVariant = "full" | "compact";
export type PromptPrinciplesFormat = "full" | "compact";

interface PromptLayoutOptions {
	contextWindow?: number | null;
	isAgent: boolean;
	isCoding: boolean;
	capabilities: PromptCapabilities;
}

export interface PromptLayoutConfig {
	metadataFormat: PromptMetadataFormat;
	principlesFormat: PromptPrinciplesFormat;
	instructionVariant: PromptInstructionVariant;
	exampleVariant: PromptExampleVariant;
	artifactExampleVariant: "full" | "compact";
}

const COMPACT_METADATA_THRESHOLD = 12000;
const COMPACT_PRINCIPLES_THRESHOLD = 9000;
const COMPACT_INSTRUCTION_THRESHOLD = 8000;
const OMIT_EXAMPLE_THRESHOLD = 4000;
const COMPACT_EXAMPLE_THRESHOLD = 8000;

export function resolvePromptLayout({
	contextWindow,
	isAgent,
	isCoding,
	capabilities,
}: PromptLayoutOptions): PromptLayoutConfig {
	const windowSize =
		typeof contextWindow === "number" && Number.isFinite(contextWindow)
			? contextWindow
			: Number.POSITIVE_INFINITY;

	const metadataFormat: PromptMetadataFormat =
		windowSize <= COMPACT_METADATA_THRESHOLD ? "compact" : "full";

	const principlesFormat: PromptPrinciplesFormat =
		windowSize <= COMPACT_PRINCIPLES_THRESHOLD ? "compact" : "full";

	let instructionVariant: PromptInstructionVariant =
		windowSize <= COMPACT_INSTRUCTION_THRESHOLD ? "compact" : "full";

	if (isAgent && windowSize > COMPACT_INSTRUCTION_THRESHOLD) {
		instructionVariant = "full";
	}

	let exampleVariant: PromptExampleVariant;

	if (isAgent) {
		exampleVariant = "omit";
	} else if (windowSize <= OMIT_EXAMPLE_THRESHOLD) {
		exampleVariant = "omit";
	} else if (windowSize <= COMPACT_EXAMPLE_THRESHOLD) {
		exampleVariant = "compact";
	} else {
		exampleVariant = "full";
	}

	if (
		(!capabilities.reasoningEnabled || capabilities.requiresThinkingPrompt) &&
		exampleVariant === "omit"
	) {
		exampleVariant = "compact";
	}

	if (isCoding && exampleVariant === "omit") {
		exampleVariant = "compact";
	}

	const artifactExampleVariant = exampleVariant === "full" ? "full" : "compact";

	return {
		metadataFormat,
		principlesFormat,
		instructionVariant,
		exampleVariant,
		artifactExampleVariant,
	};
}
