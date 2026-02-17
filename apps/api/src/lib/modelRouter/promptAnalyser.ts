import { KeywordFilter } from "~/lib/keywords";
import {
	getAuxiliaryModel,
	getAvailableStrengths,
} from "~/lib/providers/models";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { availableFunctions } from "~/services/functions";
import type { Attachment, IEnv, IUser, PromptRequirements } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { safeParseJson } from "~/utils/json";

const logger = getLogger({ prefix: "lib/modelRouter/promptAnalyser" });

export class PromptAnalyzer {
	private static readonly FILTERS = {
		coding: new KeywordFilter(KeywordFilter.getAllCodingKeywords()),
		math: new KeywordFilter(KeywordFilter.getAllMathKeywords()),
		general_knowledge: new KeywordFilter(KeywordFilter.getAllGeneralKeywords()),
		creative: new KeywordFilter(KeywordFilter.getAllCreativeKeywords()),
		reasoning: new KeywordFilter(KeywordFilter.getAllReasoningKeywords()),
	};

	private static async analyzeWithAI(
		env: IEnv,
		prompt: string,
		keywords: string[],
		user: IUser,
	): Promise<PromptRequirements> {
		try {
			const analysisResponse = await PromptAnalyzer.performAIAnalysis(
				env,
				prompt,
				keywords,
				user,
			);
			return PromptAnalyzer.validateAndParseAnalysis(analysisResponse);
		} catch (error) {
			throw new AssistantError(
				`Prompt analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				ErrorType.UNKNOWN_ERROR,
			);
		}
	}

	private static async performAIAnalysis(
		env: IEnv,
		prompt: string,
		keywords: string[],
		user: IUser,
	) {
		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliaryModel(env, user);

		const provider = getChatProvider(providerToUse, { env, user });

		return provider.getResponse({
			env,
			model: modelToUse,
			disable_functions: true,
			messages: [
				{
					role: "system",
					content: PromptAnalyzer.constructsystem_prompt(keywords),
				},
				{ role: "user", content: prompt },
			],
			user,
			response_format: { type: "json_object" },
		});
	}

	private static constructsystem_prompt(keywords: string[]): string {
		const categorizedKeywords = keywords.reduce(
			(acc, keyword) => {
				for (const [domain, filter] of Object.entries(PromptAnalyzer.FILTERS)) {
					const categories = filter.getCategorizedMatches(keyword);
					if (Object.keys(categories).length > 0) {
						acc[domain] = acc[domain] || {};
						for (const [category, words] of Object.entries(categories)) {
							acc[domain][category] = [
								...(acc[domain][category] || []),
								...words,
							];
						}
					}
				}
				return acc;
			},
			{} as Record<string, Record<string, string[]>>,
		);

		return `You are an AI assistant analyzing a user prompt. Respond ONLY with a valid JSON object matching the following structure:
{
  "expectedComplexity": number, // 1-5 indicating task complexity
  "requiredStrengths": string[], // array of required model strengths
  "criticalStrengths": string[], // array of absolutely critical model strengths
  "estimatedInputTokens": number, // estimated number of input tokens
  "estimatedOutputTokens": number, // estimated number of output tokens
  "needsFunctions": boolean, // true if the task requires function calling based on available tools that is not available its strengths: ${JSON.stringify(availableFunctions)}
  "benefitsFromMultipleModels": boolean, // true if the task would benefit from multiple AI models' perspectives
  "modelComparisonReason": string // brief explanation of why multiple models would be beneficial, if applicable
}

Only choose requiredStrengths and criticalStrengths that are available in this list: ${JSON.stringify(getAvailableStrengths())}.

Base your analysis on the prompt and these categorized keywords: ${JSON.stringify(categorizedKeywords, null, 2)}. 

For the "benefitsFromMultipleModels" field, consider:
1. Does the request ask for multiple perspectives or comparative analysis?
2. Is this a general knowledge question that might benefit from different model strengths?
3. Would creative questions benefit from seeing different model outputs?
4. For complex reasoning tasks, would having a second opinion be valuable?

If you determine multiple models would be beneficial, provide a brief reason in "modelComparisonReason".

Ensure the output is nothing but the JSON object itself.`;
	}

	private static validateAndParseAnalysis(analysisResponse: {
		choices?: {
			message: {
				content: string;
			};
		}[];
		response?: string;
	}): PromptRequirements {
		const openAiResponse = analysisResponse?.choices?.[0]?.message?.content;
		const workersAiResponse = analysisResponse?.response;

		const aiResponse = openAiResponse || workersAiResponse;

		if (!aiResponse) {
			throw new AssistantError(
				"No valid AI response received",
				ErrorType.PROVIDER_ERROR,
			);
		}

		let cleanedContent = aiResponse.trim();

		// Remove outer code block markers if present (```json ... ```)
		cleanedContent = cleanedContent
			.replace(/^```(?:json)?\s*\n?/i, "")
			.replace(/\n?```$/g, "");

		// Remove any remaining backticks that might be inside the content
		cleanedContent = cleanedContent.replace(/`/g, "");

		let requirementsAnalysis: Partial<PromptRequirements>;

		try {
			// NOTE: This is not using safeParseJson to allow the error to be caught below
			requirementsAnalysis = JSON.parse(cleanedContent);
		} catch (error) {
			logger.error(
				"Failed to parse JSON response:",
				error,
				"Original Content:",
				aiResponse,
				"Cleaned Content:",
				cleanedContent,
			);

			try {
				const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
				if (jsonMatch) {
					requirementsAnalysis = safeParseJson<Partial<PromptRequirements>>(
						jsonMatch[0],
					);
					if (!requirementsAnalysis) {
						throw new AssistantError(
							"Invalid JSON response from AI analysis",
							ErrorType.PROVIDER_ERROR,
						);
					}
				} else {
					throw new AssistantError(
						"Could not extract valid JSON",
						ErrorType.PARAMS_ERROR,
					);
				}
			} catch (_fallbackError) {
				throw new AssistantError(
					"Invalid JSON response from AI analysis",
					ErrorType.PROVIDER_ERROR,
				);
			}
		}

		if (
			!requirementsAnalysis ||
			typeof requirementsAnalysis.expectedComplexity !== "number" ||
			!Array.isArray(requirementsAnalysis.requiredStrengths)
		) {
			logger.error(
				"Incomplete or invalid AI analysis structure:",
				requirementsAnalysis,
			);
			throw new AssistantError(
				"Incomplete or invalid AI analysis structure",
				ErrorType.PROVIDER_ERROR,
			);
		}

		return PromptAnalyzer.normalizeRequirements(requirementsAnalysis);
	}

	private static normalizeRequirements(
		analysis: Partial<PromptRequirements>,
	): PromptRequirements {
		return {
			expectedComplexity: Math.max(
				1,
				Math.min(5, analysis.expectedComplexity || 1),
			) as 1 | 2 | 3 | 4 | 5,
			requiredStrengths: analysis.requiredStrengths || [],
			estimatedInputTokens: Math.max(0, analysis.estimatedInputTokens || 0),
			estimatedOutputTokens: Math.max(0, analysis.estimatedOutputTokens || 0),
			needsFunctions: !!analysis.needsFunctions,
			hasImages: false,
			hasDocuments: false,
			benefitsFromMultipleModels: !!analysis.benefitsFromMultipleModels,
			modelComparisonReason: analysis.modelComparisonReason || "",
		};
	}

	private static extractKeywords(prompt: string): string[] {
		const categorizedMatches = Object.entries(PromptAnalyzer.FILTERS).reduce(
			(acc, [_domain, filter]) => {
				const matches = filter.getCategorizedMatches(prompt);
				for (const [key, value] of Object.entries(matches)) {
					acc[key] = [...(acc[key] || []), ...value];
				}
				return acc;
			},
			{} as Record<string, string[]>,
		);

		const allMatches = Object.values(categorizedMatches).flat();
		if (allMatches.length > 0) {
			return [...new Set(allMatches)];
		}

		return PromptAnalyzer.fallbackKeywordExtraction(prompt);
	}

	private static fallbackKeywordExtraction(prompt: string): string[] {
		const words = prompt
			.toLowerCase()
			.split(/[\s,.-]+/)
			.filter((word) => word.length > 2);

		const matches = words.filter(
			(word) =>
				PromptAnalyzer.FILTERS.coding.hasKeywords(word) ||
				PromptAnalyzer.FILTERS.math.hasKeywords(word),
		);

		return [...new Set(matches)].slice(0, 5);
	}

	public static async analyzePrompt(
		env: IEnv,
		prompt: string,
		attachments?: Attachment[],
		budget_constraint?: number,
		user?: IUser,
	): Promise<PromptRequirements> {
		const keywords = PromptAnalyzer.extractKeywords(prompt);
		const aiAnalysis = await PromptAnalyzer.analyzeWithAI(
			env,
			prompt,
			keywords,
			user,
		);

		return {
			...aiAnalysis,
			budget_constraint,
			hasImages: !!attachments?.some((a) => a.type === "image"),
			hasDocuments: !!attachments?.some((a) => a.type === "document"),
		};
	}
}
