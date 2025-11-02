import { sanitiseInput } from "~/lib/chat/utils";
import type { ConversationManager } from "~/lib/conversationManager";
import { getAuxiliaryModel } from "~/lib/models";
import { tutorSystemPrompt } from "~/lib/prompts";
import { AIProviderFactory } from "~/lib/providers/factory";
import { handleWebSearch } from "~/services/search/web";
import type { IEnv, IUser, SearchOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export interface TutorRequestParams {
	topic: string;
	level: "beginner" | "intermediate" | "advanced";
	options: SearchOptions;
	completion_id?: string;
	store?: boolean;
}

// TODO: At the moment, this is all one shot. We should make multiple API calls on the frontend so the user isn't waiting too long for the response.
// TODO: Figure out how we can build this into the frontend via dynamic apps and tool calls.
export async function completeTutorRequest(
	env: IEnv,
	user?: IUser,
	body?: TutorRequestParams,
	conversationManager?: ConversationManager,
) {
	const {
		topic: rawTopic,
		level = "advanced",
		options,
		completion_id,
	} = body || {};

	const topic = sanitiseInput(rawTopic);

	if (!topic || !options) {
		throw new AssistantError(
			"Missing question or options",
			ErrorType.PARAMS_ERROR,
		);
	}

	const query = `I want to learn about ${topic}`;

	const [webSearchResults] = await Promise.all([
		// TODO: Maybe we need to scrape to get the full content or force include raw content?
		handleWebSearch({
			query,
			options: {
				search_depth: options.search_depth,
				include_answer: options.include_answer,
				include_raw_content: options.include_raw_content,
				include_images: options.include_images,
				max_results: 9,
			},
			env: env,
			user: user,
		}),
	]);

	const searchData = webSearchResults.data || {};
	const searchResults = Array.isArray(searchData.results)
		? searchData.results
		: [];
	const sources = searchResults.map((result: any) => {
		return {
			title: result.title,
			url: result.url,
			content: result.content,
			excerpts: result.excerpts || [],
			score: result.score,
		};
	});

	const providerUsed = searchData.provider;
	const providerWarning = searchData.warning;

	const parsedSources = sources
		.map((source: any, index: number) => {
			return `## Webpage #${index}: \n ${source.content}`;
		})
		.join("\n\n");

	const completion_id_with_fallback = completion_id || generateId();
	const new_completion_id = `${completion_id_with_fallback}-tutor`;

	const systemPrompt = tutorSystemPrompt(parsedSources, level);

	const { model: modelToUse, provider: providerToUse } =
		await getAuxiliaryModel(env, user);
	const provider = AIProviderFactory.getProvider(providerToUse);

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
		completion_id: new_completion_id,
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
		user: user,
		store: false,
	});

	if (conversationManager) {
		await conversationManager.add(new_completion_id, {
			role: "tool",
			content: "Tutor request completed",
			data: {
				answer: answerResponse.response,
				sources,
				provider: providerUsed,
				providerWarning,
				name: "tutor",
				formattedName: "Tutor",
				responseType: "custom",
			},
			name: "tutor",
			status: "success",
			timestamp: Date.now(),
			platform: "api",
			model: modelToUse,
		});

		await conversationManager.updateConversation(new_completion_id, {
			title: `Learn about ${topic}`,
		});
	}

	return {
		answer: answerResponse.response,
		sources,
		provider: providerUsed,
		providerWarning,
		completion_id: new_completion_id,
	};
}
