import { handleCreateApplyEditCompletions } from "~/services/completions/createApplyEditCompletions";
import type { IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const apply_edit_completion: ApiToolDefinition = {
	name: "apply_edit_completion",
	description:
		"Apply a code snippet update using Mercury Coder's apply-edit capability.",
	type: "premium",
	costPerCall: 0,
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			prompt: {
				type: "string",
				description:
					"Structured prompt containing the original code block and the update snippet to apply.",
			},
			model: {
				type: "string",
				description:
					"Optional Mercury model to use for applying the edit (defaults to the best available).",
			},
		},
		required: ["prompt"],
	}),
	execute: async (args, context) => {
		const req = context.request;

		if (!args.prompt || typeof args.prompt !== "string") {
			return {
				status: "error",
				name: "apply_edit_completion",
				content: "A prompt string is required to apply an edit.",
				role: "tool",
			};
		}

		const response = await handleCreateApplyEditCompletions({
			env: req.env,
			user: req.user,
			model: typeof args.model === "string" ? args.model : undefined,
			messages: [
				{
					role: "user",
					content: args.prompt,
				},
			],
		});

		const completionText =
			response?.choices?.[0]?.message?.content ??
			response?.choices?.[0]?.text ??
			response?.response ??
			"";

		if (!completionText) {
			return {
				status: "error",
				name: "apply_edit_completion",
				content: "The edit model did not return a result.",
				data: response,
				role: "tool",
			};
		}

		return {
			status: "success",
			name: "apply_edit_completion",
			content: completionText,
			data: {
				model: response?.model ?? args.model,
				raw: response,
			},
			role: "tool",
		};
	},
};
