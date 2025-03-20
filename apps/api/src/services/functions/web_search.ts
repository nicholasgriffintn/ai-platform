import type { ConversationManager } from "../../lib/conversationManager";
import type { IFunction, IRequest, SearchOptions } from "../../types";
import { performDeepWebSearch } from "../apps/web-search";

export const web_search: IFunction = {
	name: "web_search",
	description:
		"Search the web for current information. Use this when you need to find up-to-date information about a topic.",
	parameters: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The search query to look up",
			},
			search_depth: {
				type: "string",
				description:
					"The depth of the search - 'basic' for quick results or 'advanced' for more comprehensive results",
				default: "basic",
			},
			include_answer: {
				type: "boolean",
				description:
					"Whether to include an AI-generated answer in the response",
				default: false,
			},
			include_raw_content: {
				type: "boolean",
				description:
					"Whether to include the raw content from the search results",
				default: false,
			},
			include_images: {
				type: "boolean",
				description: "Whether to include images in the search results",
				default: false,
			},
		},
		required: ["query"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		app_url?: string,
		conversationManager?: ConversationManager,
	) => {
		const {
			query,
			search_depth,
			include_answer,
			include_raw_content,
			include_images,
		} = args;
		const options: SearchOptions = {
			search_depth,
			include_answer,
			include_raw_content,
			include_images,
		};

		const {
			answer,
			sources,
			similarQuestions,
			completion_id: web_search_completion_id,
		} = await performDeepWebSearch(
			req.env,
			req.user,
			{
				query,
				options,
				completion_id,
			},
			conversationManager,
		);

		return {
			name: "web_search",
			status: "success",
			content: "Web search completed",
			data: {
				answer,
				sources,
				similarQuestions,
				completion_id: web_search_completion_id,
			},
		};
	},
};
