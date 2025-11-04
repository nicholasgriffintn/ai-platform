import { sanitiseInput } from "~/lib/chat/utils";
import type { ConversationManager } from "~/lib/conversationManager";
import { getAuxiliaryModel } from "~/lib/models";
import {
	webSearchAnswerSystemPrompt,
	webSearchSimilarQuestionsSystemPrompt,
} from "~/lib/prompts";
import { AIProviderFactory } from "~/lib/providers/factory";
import { handleWebSearch } from "~/services/search/web";
import type { IEnv, IUser, SearchOptions, SearchProviderName } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface DeepWebSearchParams {
	query: string;
	options: SearchOptions;
	completion_id?: string;
	searchProvider?: SearchProviderName;
}

// TODO: At the moment, this is all one shot. We should make multiple API calls on the frontend so the user isn't waiting too long for the response.
// TODO: Figure out how we can build this into the frontend via dynamic apps and tool calls.
export async function performDeepWebSearch(
	env: IEnv,
	user?: IUser,
	body?: DeepWebSearchParams,
	conversationManager?: ConversationManager,
) {
	const {
		query: rawQuery,
		options,
		completion_id,
		searchProvider,
	} = body || {};

	const query = sanitiseInput(rawQuery);

	if (!query || !options) {
		throw new AssistantError(
			"Missing query or options",
			ErrorType.PARAMS_ERROR,
		);
	}

	const { model: modelToUse, provider: providerToUse } =
		await getAuxiliaryModel(env, user);
	const provider = AIProviderFactory.getProvider(providerToUse);

	const [webSearchResults, similarQuestionsResponse] = await Promise.all([
		// TODO: Maybe we need to scrape to get the full content or force include raw content?
		handleWebSearch({
			provider: searchProvider,
			query: query,
			options: {
				search_depth: options.search_depth,
				include_answer: options.include_answer,
				include_raw_content: options.include_raw_content,
				include_images: options.include_images,
			},
			env: env,
			user: user,
		}),

		(async () => {
			return provider.getResponse({
				env: env,
				user: user,
				completion_id,
				model: modelToUse,
				messages: [
					{
						role: "system",
						content: webSearchSimilarQuestionsSystemPrompt(),
					},
					{
						role: "user",
						content: query,
					},
				],
				store: false,
				response_format: {
					type: "json_schema",
					json_schema: {
						name: "similar_questions",
						strict: true,
						schema: {
							type: "object",
							properties: {
								questions: {
									type: "array",
									items: {
										type: "string",
									},
								},
							},
							required: ["questions"],
							additionalProperties: false,
						},
					},
				},
			});
		})(),
	]);

	const searchData = webSearchResults.data || {};
	const rawSearchResult = searchData.result;
	const searchResults = Array.isArray(searchData.results)
		? searchData.results
		: Array.isArray(rawSearchResult?.results)
			? rawSearchResult.results
			: [];
	const searchAnswer = rawSearchResult?.answer as string | undefined;
	const providerUsed = searchData.provider as SearchProviderName | undefined;
	const providerWarning = searchData.warning as string | undefined;

	const sources = searchResults.map((result: any) => {
		return {
			title: result.title,
			url: result.url,
			content:
				result.content ||
				result.snippet ||
				result.excerpt ||
				result.description ||
				result.summary ||
				result.title,
			excerpts: result.excerpts || [],
			score: result.score,
			image: result.imageUrl || result.image || undefined,
			favicon: result.favicon || undefined,
			publishedDate:
				result.publishedDate || result.date || result.last_updated || undefined,
		};
	});

	const hasSimarQuestions =
		similarQuestionsResponse?.response &&
		Array.isArray(similarQuestionsResponse.response.questions);
	const isContentAnStringifiedArray =
		typeof similarQuestionsResponse?.response === "string" &&
		similarQuestionsResponse.response.trim().startsWith("[") &&
		similarQuestionsResponse.response.trim().endsWith("]");
	let similarQuestions: string[] = [];

	if (hasSimarQuestions) {
		similarQuestions = similarQuestionsResponse.response.questions;
	} else if (isContentAnStringifiedArray) {
		try {
			const parsed = JSON.parse(similarQuestionsResponse.response) as string[];
			if (Array.isArray(parsed)) {
				similarQuestions = parsed;
			}
		} catch (e) {
			// Ignore parsing errors
		}
	}

	const completion_id_with_fallback = completion_id || generateId();
	const new_completion_id = `${completion_id_with_fallback}-tutor`;

	const answerContexts = sources
		.map((source: any, index: number) => {
			return `${searchAnswer ? `[[answer]] ${searchAnswer}` : ""}[[citation:${index}]] ${source.content}`;
		})
		.join("\n\n");
	const systemPrompt = webSearchAnswerSystemPrompt(answerContexts);

	if (conversationManager) {
		await conversationManager.add(new_completion_id, {
			role: "system",
			content: systemPrompt,
			timestamp: Date.now(),
			platform: "api",
			model: modelToUse,
		});

		await conversationManager.add(new_completion_id, {
			role: "user",
			content: query,
			timestamp: Date.now(),
			platform: "api",
			model: modelToUse,
		});
	}

	const answerResponse = await provider.getResponse({
		env: env,
		user: user,
		completion_id,
		model: modelToUse,
		messages: [
			{
				role: "system",
				content: systemPrompt,
			},
			{
				role: "user",
				content: query,
			},
		],
		store: false,
	});

	if (conversationManager) {
		await conversationManager.add(new_completion_id, {
			role: "tool",
			content: "Web search completed",
			data: {
				answer: answerResponse.response,
				sources,
				provider: providerUsed,
				providerWarning,
				name: "web_search",
				formattedName: "Web Search",
				responseType: "custom",
			},
			name: "web_search",
			timestamp: Date.now(),
			platform: "api",
			model: modelToUse,
		});

		await conversationManager.updateConversation(new_completion_id, {
			title: `Web search for ${query}`,
		});
	}

	return {
		answer: answerResponse.response,
		similarQuestions,
		sources,
		provider: providerUsed,
		providerWarning,
		completion_id: new_completion_id,
	};
}
