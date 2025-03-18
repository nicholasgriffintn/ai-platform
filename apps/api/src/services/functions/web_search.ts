import { getAIResponse } from "../../lib/chat";
import { webSearchsystem_prompt } from "../../lib/prompts";
import type { ChatRole, IFunction, IRequest, Message } from "../../types";
import { handleWebSearch } from "../search/web";

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
	) => {
		const result = await handleWebSearch({
			query: args.query,
			provider: "tavily",
			options: {
				search_depth: args.search_depth,
				include_answer: args.include_answer,
				include_raw_content: args.include_raw_content,
				include_images: args.include_images,
			},
			env: req.env,
			user: req.user,
		});

		return result;
	},
};
