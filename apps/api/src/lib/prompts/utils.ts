import type { VerbosityLevel } from "~/types";
import type { PromptModelMetadata } from "./sections/metadata";

export interface PromptCapabilities {
	supportsToolCalls: boolean;
	simulatedThinking: boolean;
}

interface ResolvePromptCapabilityArgs {
	supportsToolCalls?: boolean;
	simulatedThinking?: boolean;
	modelMetadata?: PromptModelMetadata;
}

export function resolvePromptCapabilities({
	supportsToolCalls,
	simulatedThinking,
	modelMetadata,
}: ResolvePromptCapabilityArgs): PromptCapabilities {
	const metadata = modelMetadata?.modelConfig;

	return {
		supportsToolCalls: supportsToolCalls ?? metadata?.supportsToolCalls ?? false,
		simulatedThinking: simulatedThinking ?? false,
	};
}

export interface ResponseStyle {
	traits: string;
	preferences: string;
}

export function getResponseStyle(
	verbosity?: VerbosityLevel,
	userTraits?: string | null,
	userPreferences?: string | null,
	isCoding = false,
	isAgent = false,
	simulatedThinking = false,
	instructionVariant: "full" | "compact" = "full",
): ResponseStyle {
	if (verbosity === "caveman") {
		const cavemanPreferences = `Respond terse like smart caveman: all technical substance stays, fluff dies.
- Drop articles (a/an/the), filler, pleasantries, hedging, and redundant transitions.
- Fragments are fine. Prefer short synonyms and common technical abbreviations such as DB, auth, config, req, res, fn, and impl.
- Use arrows for causality where clear, for example: "X -> Y".
- Preserve exact technical terms, code, commands, filenames, errors, API names, and quoted text.
- Prefer pattern: "[thing] [action] [reason]. [next step]."
- Stay accurate and complete; never omit required warnings, constraints, validation results, or user-requested detail.
- Temporarily use normal clear prose for security warnings, irreversible action confirmations, multi-step instructions where fragments could be misread, or when the user asks for clarification. Resume caveman style after the clear part.`;

		return {
			traits:
				"terse, technical, direct, compressed, practical, caveman-style without losing accuracy",
			preferences: userPreferences
				? `${cavemanPreferences}\n- Also respect these user preferences when they do not conflict with caveman brevity:\n${userPreferences}`
				: cavemanPreferences,
		};
	}

	const normalizedVerbosity: Exclude<VerbosityLevel, "caveman"> =
		verbosity === "low" || verbosity === "high" ? verbosity : "medium";
	const traits =
		userTraits ||
		"direct, intellectually curious, clear, practical, and systematic when reasoning through complex problems";
	const basePreferences =
		instructionVariant === "compact"
			? ["Answer directly without filler.", "Match explanation depth to the task's complexity."]
			: [
					"Answer directly without unnecessary filler.",
					"Match response length to question complexity—concise for simple questions and thorough for complex ones.",
					"Offer to elaborate when the user asks; avoid over-explaining upfront.",
				];

	if (simulatedThinking) {
		basePreferences.push(
			"Analyse the task thoroughly before answering, but share only the reasoning summary that helps the user understand the result.",
		);
		if (isCoding) {
			basePreferences.push(
				"Internally identify assumptions, sketch pseudocode where useful, consider edge cases, and validate the solution before answering.",
			);
		}
	}

	if (userPreferences) {
		basePreferences.push(
			`Also respect these user preferences when they do not conflict with higher-priority instructions:\n${userPreferences}`,
		);
	}

	const styleByVerbosity: Record<Exclude<VerbosityLevel, "caveman">, string> = {
		low: "Keep explanations tight and avoid restating obvious context.",
		medium: "Balance concision with enough context for the user to understand and act.",
		high: "Explain relevant context, assumptions, examples, edge cases, and trade-offs in depth.",
	};
	const selectedStyle = styleByVerbosity[normalizedVerbosity];
	basePreferences.push(selectedStyle);
	if (isAgent) {
		basePreferences.push("Conclude with outcomes and recommended next actions when useful.");
	}

	return {
		traits,
		preferences: basePreferences.map((preference) => `- ${preference}`).join("\n"),
	};
}

/**
 * Return an empty prompt string
 */
export function emptyPrompt(): string {
	return "";
}
