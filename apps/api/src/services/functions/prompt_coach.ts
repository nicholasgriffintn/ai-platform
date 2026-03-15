import { handlePromptCoachSuggestion } from "~/services/apps/prompt-coach";
import type { IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const prompt_coach: ApiToolDefinition = {
	name: "prompt_coach",
	description:
		"Given a prompt, this function will return an enhanced variant with suggestions for improvement.",
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description: "The prompt to improve",
			},
			recursionDepth: {
				type: "number",
				description: "The depth of the recursive search",
			},
			promptType: {
				type: "string",
				description: "The type of prompt",
			},
		},
		required: ["prompt"],
	}),
	type: "normal",
	costPerCall: 0,
	execute: async (args, context) => {
		const req = context.request;

		if (!args.prompt) {
			return {
				status: "error",
				name: "prompt_coach",
				content: "Missing prompt",
				data: {},
			};
		}

		const response = await handlePromptCoachSuggestion({
			env: req.env,
			user: req.user,
			prompt: args.prompt,
			recursionDepth: args.recursionDepth,
			promptType: args.promptType,
		});

		return {
			status: "success",
			name: "prompt_coach",
			content: "Prompt coach response",
			data: response,
		};
	},
};
