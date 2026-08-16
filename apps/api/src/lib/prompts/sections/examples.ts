import type { VerbosityLevel } from "~/types";
import { PromptBuilder } from "../builder";
import type { PromptExampleVariant } from "../layout";

interface StandardExampleOptions {
	simulatedThinking?: boolean;
	problemBreakdownInstructions: string;
	answerFormatInstructions: string;
	variant?: Exclude<PromptExampleVariant, "omit">;
}

interface CodingExampleOptions {
	simulatedThinking?: boolean;
	problemBreakdownInstructions: string;
	answerFormatInstructions: string;
	preferredLanguage?: string;
	verbosity?: VerbosityLevel;
	variant?: Exclude<PromptExampleVariant, "omit">;
}

export function buildStandardExampleOutputSection({
	simulatedThinking,
	problemBreakdownInstructions,
	answerFormatInstructions,
	variant = "full",
}: StandardExampleOptions): string {
	if (variant === "compact") {
		const builder = new PromptBuilder("<example_output>\n");

		if (simulatedThinking) {
			builder.addLine("<think>").addLine(problemBreakdownInstructions).addLine("</think>");
		}

		builder
			.addLine("<answer>")
			.addLine(answerFormatInstructions)
			.addLine("</answer>")
			.addLine("</example_output>")
			.addLine();

		return builder.build();
	}

	const builder = new PromptBuilder()
		.addLine("Here is an example of the output you should provide:")
		.addLine("<example_output>");

	if (simulatedThinking) {
		builder.addLine("<think>").addLine(problemBreakdownInstructions).addLine("</think>");
	}

	builder
		.addLine("<answer>")
		.addLine(answerFormatInstructions)
		.addLine("</answer>")
		.addLine("</example_output>")
		.addLine();

	return builder.build();
}

export function buildCodingExampleOutputSection({
	simulatedThinking,
	problemBreakdownInstructions,
	answerFormatInstructions,
	preferredLanguage,
	verbosity,
	variant = "full",
}: CodingExampleOptions): string {
	const proseLanguage = preferredLanguage || "the user's preferred language";
	const codeLanguagePlaceholder = "{{programming_language}}";

	const toneHint = (() => {
		switch (verbosity) {
			case "caveman":
				return "<tone_hint>Use caveman brevity: terse fragments, exact technical terms, no filler, complete substance.</tone_hint>";
			case "low":
				return "<tone_hint>Keep explanations crisp and focus on the actionable answer.</tone_hint>";
			case "high":
				return "<tone_hint>Provide an instructive tone, expanding on each major decision.</tone_hint>";
			default:
				return "";
		}
	})();

	const builder = new PromptBuilder();

	if (variant === "full") {
		builder
			.addLine("Here is an example of the output you should provide:")
			.addLine("<example_output>")
			.addLine("<answer>")
			.addLine(
				"<introduction>Brief introduction addressing the user's question or request</introduction>",
			)
			.addLine();
	} else {
		builder.addLine("<example_output>").addLine("<answer>");
	}

	if (simulatedThinking) {
		builder.addLine("<think>").addLine(problemBreakdownInstructions).addLine("</think>");
		if (variant === "full") {
			builder.addLine();
		}
	}

	builder
		.addLine("<solution>")
		.addLine(
			`<code_block language="${codeLanguagePlaceholder}">// Provide the final implementation here.</code_block>`,
		)
		.addLine("<explanation>")
		.addLine(
			`- Outline the main approach, including key helpers or data structures, using ${proseLanguage}.`,
		)
		.addLine("- Note any assumptions or trade-offs that influenced the implementation.")
		.addLine("</explanation>")
		.addLine("<reference_note>")
		.addLine(answerFormatInstructions)
		.addLine("</reference_note>")
		.addLine("</solution>");

	builder
		.addLine(
			"<implementation_explanation>Explain the key pieces of the implementation.</implementation_explanation>",
		)
		.addLine(
			"<additional_info>Add best practices or alternatives when they help the user.</additional_info>",
		)
		.addLine("<validation>Note tests or checks you ran plus critical edge cases.</validation>")
		.addLine(
			"<next_steps>Offer a helpful follow-up suggestion or optimisation when relevant.</next_steps>",
		);

	if (toneHint && variant === "full") {
		builder.addLine(toneHint);
	}

	builder.addLine("</answer>").addLine("</example_output>").addLine();

	return builder.build();
}
