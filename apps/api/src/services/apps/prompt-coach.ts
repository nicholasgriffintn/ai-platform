import { getAIResponse } from "~/lib/chat/responses";
import { sanitiseInput } from "~/lib/chat/utils";
import { returnCoachingPrompt } from "~/lib/prompts/coaching";
import type { ChatCompletionParameters, IEnv, IUser, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/apps/prompt-coach" });

export interface PromptCoachResponse {
	suggested_prompt: string | null;
	full_response: string;
	analysis?: string;
	suggestions?: string[];
	format_optimization?: string;
	confidence_score?: number;
	prompt_type?: string;
}

export type PromptType =
	| "general"
	| "creative"
	| "technical"
	| "instructional"
	| "analytical";

export const handlePromptCoachSuggestion = async (req: {
	env: IEnv;
	user?: IUser;
	prompt: string;
	recursionDepth?: number;
	promptType?: PromptType;
}): Promise<PromptCoachResponse> => {
	const {
		env,
		user,
		prompt: userPrompt,
		recursionDepth = 0,
		promptType = "general",
	} = req;

	try {
		const sanitisedPrompt = sanitiseInput(userPrompt);

		const coachingSystemPrompt = returnCoachingPrompt({
			prompt: sanitisedPrompt,
			promptType,
		});

		const messages: Message[] = [
			{
				role: "user",
				content: coachingSystemPrompt,
			},
		];

		const payload: ChatCompletionParameters = {
			model: "llama-3.3-70b-versatile",
			messages: messages,
			temperature: 0.5,
			max_tokens: 1500,
			stream: false,
			store: false,
			env: env,
			user: user,
		};

		const aiResult = await getAIResponse(payload);

		if (!aiResult.response) {
			throw new AssistantError(
				"AI model did not return a response.",
				ErrorType.EXTERNAL_API_ERROR,
			);
		}

		const aiResponseContent = aiResult.response;
		logger.info("AI response content received for prompt coaching");

		const extractTagContent = (
			content: string,
			tagName: string,
		): string | null => {
			const regex = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i");
			const match = regex.exec(content);
			return match?.[1]?.trim() ?? null;
		};

		const suggestedPrompt = extractTagContent(
			aiResponseContent,
			"revised_prompt",
		);
		const promptAnalysis = extractTagContent(
			aiResponseContent,
			"prompt_analysis",
		);
		const suggestionsContent = extractTagContent(
			aiResponseContent,
			"suggestions",
		);
		const formatOptimization = extractTagContent(
			aiResponseContent,
			"format_optimization",
		);
		const promptTypeResult = extractTagContent(
			aiResponseContent,
			"prompt_type",
		);

		const suggestions = suggestionsContent
			? suggestionsContent
					.split(/\d+\./)
					.filter((item) => item.trim().length > 0)
					.map((item) => item.trim())
			: [];

		const confidenceScore = calculateConfidenceScore(aiResponseContent);

		if (recursionDepth > 0 && suggestedPrompt) {
			logger.info(
				`Performing recursive prompt improvement: depth ${recursionDepth}`,
			);
			return handlePromptCoachSuggestion({
				env,
				user,
				prompt: suggestedPrompt,
				recursionDepth: recursionDepth - 1,
				promptType: promptTypeResult as PromptType,
			});
		}

		const response: PromptCoachResponse = {
			suggested_prompt: suggestedPrompt,
			full_response: aiResponseContent,
			analysis: promptAnalysis,
			suggestions,
			format_optimization: formatOptimization,
			confidence_score: confidenceScore,
			prompt_type: promptTypeResult as PromptType,
		};

		return response;
	} catch (error) {
		logger.error(`Prompt coach suggestion error: ${error}`);

		if (error instanceof AssistantError) {
			throw error;
		}
		throw new AssistantError(
			"An unexpected error occurred during prompt coaching suggestion.",
			ErrorType.INTERNAL_ERROR,
		);
	}
};

function calculateConfidenceScore(response: string): number {
	let score = 0.5;

	if (response.includes("<prompt_analysis>")) score += 0.1;
	if (response.includes("<revised_prompt>")) score += 0.2;
	if (response.includes("<suggestions>")) score += 0.1;
	if (response.includes("<format_optimization>")) score += 0.1;

	const responseLength = response.length;
	if (responseLength > 1000) score += 0.1;

	return Math.min(score, 1.0);
}
