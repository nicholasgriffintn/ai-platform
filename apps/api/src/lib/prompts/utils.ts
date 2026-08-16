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

export function getResponseStyle(
	verbosity?: VerbosityLevel,
	simulatedThinking = false,
	supportsToolCalls = false,
	isAgent = false,
	memoriesEnabled = false,
	userTraits?: string,
	userPreferences?: string,
	isCoding = false,
	instructionVariant: "full" | "compact" = "full",
): {
	traits: string;
	preferences: string;
	problemBreakdownInstructions: string;
	answerFormatInstructions: string;
} {
	if (verbosity === "caveman") {
		const cavemanPreferences = `- Respond terse like smart caveman: all technical substance stays, fluff dies.
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
			problemBreakdownInstructions:
				"Use a tiny breakdown only when needed. Fragments OK. Keep causality clear with arrows.",
			answerFormatInstructions: `Deliver ${isCoding ? "code" : "answer"} in compressed caveman style. Keep all technical substance; remove filler.`,
		};
	}

	const normalizedVerbosity: VerbosityLevel =
		verbosity === "low" || verbosity === "high" ? verbosity : "medium";

	const DEFAULT_TRAITS =
		userTraits ||
		"direct, intellectually curious, balanced in verbosity (concise for simple questions, thorough for complex ones), systematic in reasoning for complex problems";

	const FULL_DEFAULT_PREFERENCES = `- Answer directly without unnecessary filler.
  - Provide a brief overview of your approach so the user can follow along.
  - Match response length to question complexity—concise for simple questions, thorough for complex ones.
  - Offer to elaborate when the user asks; avoid over-explaining upfront.
  - Cite authoritative sources for specific facts and flag uncertainty only when information is incomplete.
  - Ask follow-up questions only when information is missing or safety requires clarification (more than one is fine if essential).
  - Keep chat in Markdown prose. Place substantial code or data in fenced blocks.
  - If a tool fails: retry once if safe; otherwise summarise the failure briefly and offer an alternative.
  - Write your response in the same language as the task posed by the user.`;

	const COMPACT_DEFAULT_PREFERENCES = `- Provide clear, direct answers without filler.
  - Ask for missing details only when essential; multiple follow-ups are fine when safety or accuracy demands it.
  - Match explanation depth to the task's complexity.
  - Keep chat in Markdown; put substantial code or data in fenced blocks.
  - If a tool fails: retry once if safe, otherwise summarise and suggest an alternative.
  - Reply in the same language the user used.`;

	const DEFAULT_PREFERENCES =
		userPreferences ||
		(instructionVariant === "compact" ? COMPACT_DEFAULT_PREFERENCES : FULL_DEFAULT_PREFERENCES);

	if (instructionVariant === "compact") {
		const compactProblemBreakdownInstructions = (() => {
			switch (normalizedVerbosity) {
				case "low":
					return "Capture only the key checks or steps before you answer.";
				case "high":
					return "Highlight the main stages you'll cover before the final answer.";
				default:
					return "Sketch the steps that matter so your answer stays focused.";
			}
		})();

		const compactAnswerFormatInstructions = (() => {
			const deliverable = isCoding ? "code" : "answer";
			switch (normalizedVerbosity) {
				case "low":
					return `Provide the ${deliverable} with only the context the user needs to act.`;
				case "high":
					return `Deliver the ${deliverable} and briefly walk through the reasoning or workflow.`;
				default:
					return `Share the ${deliverable} and call out the key insight or next step for the user.`;
			}
		})();

		if (isAgent) {
			let agentPreferences = DEFAULT_PREFERENCES;
			const agentGuidelines: string[] = [];

			if (supportsToolCalls) {
				agentGuidelines.push("Only narrate tool usage when it helps the user act on the result.");
			}

			agentGuidelines.push("Flag uncertainty or blocking gaps early so the user can redirect you.");

			if (agentGuidelines.length > 0) {
				agentPreferences += `\n- Also keep in mind:\n${agentGuidelines
					.map((line) => `  - ${line}`)
					.join("\n")}`;
			}

			if (memoriesEnabled) {
				agentPreferences += `\n- Ask before storing long-term memories and refuse to keep sensitive personal data.`;
			} else {
				agentPreferences += `\n- If asked to remember something, explain that memories are currently disabled for this user.`;
			}

			return {
				traits: DEFAULT_TRAITS,
				preferences: agentPreferences,
				problemBreakdownInstructions: compactProblemBreakdownInstructions,
				answerFormatInstructions: compactAnswerFormatInstructions,
			};
		}

		const additionalGuidelines: string[] = [];

		if (simulatedThinking) {
			additionalGuidelines.push(
				"Before answering, outline the essential steps you will take and share them briefly with the user.",
			);
			if (isCoding) {
				additionalGuidelines.push(
					"Call out critical components and edge cases in that summary before presenting code.",
				);
			}
		}

		if (supportsToolCalls) {
			additionalGuidelines.push(
				"Use tools only when they add value; summarise outcomes when it helps the user act.",
			);
		}

		additionalGuidelines.push("Flag uncertainty or missing information instead of guessing.");
		additionalGuidelines.push("Scale your explanation to the complexity of the request.");

		let preferences = DEFAULT_PREFERENCES;

		if (additionalGuidelines.length > 0) {
			preferences += `\n- Also follow:\n${additionalGuidelines
				.map((line) => `  - ${line}`)
				.join("\n")}`;
		}

		if (isCoding) {
			preferences += `\n- Present runnable code in fenced blocks and call out assumptions or edge cases.`;
		} else {
			preferences += `\n- Keep chat in Markdown prose; add short code snippets only when they clarify the explanation.`;
		}

		if (memoriesEnabled) {
			preferences += `\n- Only store memories after explicit user consent.\n- Do not store short-lived logistics (meetings, links, one-off codes) unless the user explicitly asks.\n- Never retain passwords, credentials, financial IDs, or medical details.`;
		} else {
			preferences += `\n- If the user asks you to remember something, explain that memories are disabled and suggest alternatives.`;
		}

		return {
			traits: DEFAULT_TRAITS,
			preferences,
			problemBreakdownInstructions: compactProblemBreakdownInstructions,
			answerFormatInstructions: compactAnswerFormatInstructions,
		};
	}

	if (isAgent) {
		let agentPreferences = DEFAULT_PREFERENCES;
		agentPreferences += `\n- Prioritise built-in knowledge and retrieval before browsing external sources unless the user requests otherwise.`;
		if (supportsToolCalls) {
			agentPreferences += `\n- Narrate tool usage only when it helps the user act on the results.`;
		}
		if (memoriesEnabled) {
			agentPreferences += `\n- Only store memories after explicit user consent.\n- Do not store short-lived logistics (meetings, links, one-off codes) unless the user explicitly asks.\n- Never retain passwords, credentials, financial IDs, or medical details.`;
		} else {
			agentPreferences += `\n- If the user asks you to remember something, explain that memories are disabled and suggest alternatives.`;
		}

		return {
			traits: DEFAULT_TRAITS,
			preferences: agentPreferences,
			problemBreakdownInstructions:
				"Outline the key steps in your plan so the user understands how you will proceed before executing.",
			answerFormatInstructions: `Deliver the ${isCoding ? "solution" : "answer"} with a concise summary of outcomes and recommended next actions.`,
		};
	}

	let PREFERENCES_WITH_INSTRUCTIONS = `${DEFAULT_PREFERENCES}
  - Please also follow these instructions:\n`;

	let step = 1;
	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Read and understand questions carefully.\n`;
	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. If the question is unclear or lacks necessary information, ask for clarification.\n`;

	if (simulatedThinking) {
		PREFERENCES_WITH_INSTRUCTIONS += `${step}. Analyse the question and context thoroughly before answering, and outline the essential steps you will take.\n`;
		if (isCoding) {
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.1 Break down the problem into smaller components.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.2 List any assumptions you're making about the problem.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.3 Plan your approach to solving the problem or generating the code.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.4 Write pseudocode for your solution.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.5 Consider potential edge cases or limitations of your solution.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.6 If generating code, write it out and then analyse it for correctness, efficiency, and adherence to best practices.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${step}.7 Validate your solution with tests where practical and consider complexity and performance trade-offs.\n`;
		}

		if (supportsToolCalls) {
			const subBase = isCoding ? `${step}.8` : `${step}.1`;
			PREFERENCES_WITH_INSTRUCTIONS += `${subBase} Determine whether the query can be resolved directly or if a tool is required. Prefer the lightest option (internal knowledge → retrieval → browsing → code execution).\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${subBase}.1 When using a tool, include a short outcome summary only if it helps the user.\n`;
			PREFERENCES_WITH_INSTRUCTIONS += `${subBase}.2 Stop calling tools once you have enough information to answer confidently.\n`;
		}

		let finalSub;
		if (isCoding) {
			finalSub = supportsToolCalls ? `${step}.9` : `${step}.8`;
		} else {
			finalSub = supportsToolCalls ? `${step}.2` : `${step}.1`;
		}
		PREFERENCES_WITH_INSTRUCTIONS += `${finalSub} Keep any pre-answer summary concise and omit sensitive personal details.\n`;
		step++;
	}

	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. If you're unsure or don't have the information to answer, say "I don't know" or offer to find more information safely.\n`;

	if (supportsToolCalls && !simulatedThinking) {
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Determine whether the query can be resolved directly or if a tool is required. Prefer the lightest option (internal knowledge → retrieval → browsing → code execution).\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. When using a tool, include a short outcome summary only if it helps the user.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Stop calling tools once you have enough information to answer confidently.\n`;
	}

	if (isCoding) {
		PREFERENCES_WITH_INSTRUCTIONS += `${step}. When coding, present runnable code in fenced blocks and call out assumptions or edge cases.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step}.1. Ensure the code adheres to best practices and conventions for the specified programming language.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step}.2. Write clean, efficient, and well-documented code.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step}.3. Include comments to explain complex logic or non-obvious implementations.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step}.4. If the task requires multiple functions or classes, structure the code logically and use appropriate naming conventions.\n`;
		step++;
	} else {
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Keep chat responses in Markdown prose; add short code snippets only when they clarify the explanation.\n`;
	}

	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Include 'Key steps' for complex tasks.\n`;
	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. When referencing external information, cite reliable sources or note when evidence is limited.\n`;
	PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Engage thoughtfully with the user's ideas while respecting privacy and platform policies.`;

	if (memoriesEnabled) {
		PREFERENCES_WITH_INSTRUCTIONS += `\n${step++}. Only store memories after explicit user consent.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Do not store short-lived logistics (meetings, links, one-off codes) unless the user explicitly asks.\n`;
		PREFERENCES_WITH_INSTRUCTIONS += `${step++}. Never retain passwords, credentials, financial IDs, or medical details.\n`;
	} else {
		PREFERENCES_WITH_INSTRUCTIONS += `\n${step++}. If the user asks you to remember something, explain that memories are disabled and suggest they capture the detail another way.\n`;
	}

	switch (normalizedVerbosity) {
		case "low":
			return {
				traits: DEFAULT_TRAITS,
				preferences: PREFERENCES_WITH_INSTRUCTIONS,
				problemBreakdownInstructions:
					"Keep your problem breakdown brief, focusing only on the most critical aspects of the problem.",
				answerFormatInstructions: `Provide your ${isCoding ? "code" : "answer"} with minimal explanation, focusing on the answer itself.`,
			};
		case "high":
			return {
				traits: DEFAULT_TRAITS,
				preferences: PREFERENCES_WITH_INSTRUCTIONS,
				problemBreakdownInstructions:
					"Provide a thorough problem breakdown with detailed explanations of your thought process and approach.",
				answerFormatInstructions: `Explain your ${isCoding ? "code" : "answer"} in detail, including the reasoning behind your implementation choices and how each part works.`,
			};
		default:
			return {
				traits: DEFAULT_TRAITS,
				preferences: PREFERENCES_WITH_INSTRUCTIONS,
				problemBreakdownInstructions:
					"Provide a balanced problem breakdown that covers the important aspects without being overly verbose.",
				answerFormatInstructions: `Balance your ${isCoding ? "code" : "answer"} with explanation, providing enough context to understand the solution without overwhelming detail.`,
			};
	}
}

/**
 * Return an empty prompt string
 */
export function emptyPrompt(): string {
	return "";
}
