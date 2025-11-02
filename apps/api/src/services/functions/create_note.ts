import { sanitiseInput } from "~/lib/chat/utils";
import { insertEmbedding } from "~/services/apps/embeddings/insert";
import type { IFunction, IRequest } from "~/types";
import { AssistantError, ErrorType } from "../../utils/errors";

export const create_note: IFunction = {
	name: "create_note",
	description:
		"Stores user information, content, or AI-generated material as a retrievable note. Use when users want to save content for future reference, build a knowledge base, or maintain project information across sessions.",
	parameters: {
		type: "object",
		properties: {
			title: {
				type: "string",
				description:
					"The title of the note, this can be a summary of the content",
			},
			content: {
				type: "string",
				description: "The content of the note",
			},
			metadata: {
				type: "object",
				description: "Metadata about the note",
			},
		},
		required: ["title", "content"],
	},
	type: "premium",
	costPerCall: 0,
	function: async (
		_completion_id: string,
		args: any,
		req: IRequest,
		_app_url?: string,
	) => {
		// TODO: Remove this once we have a proper way to handle this
		if (req.user?.github_username !== "nicholasgriffintn") {
			throw new AssistantError(
				"This function is not designed for general use yet.",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const sanitisedTitle = sanitiseInput(args.title);
		const sanitisedContent = sanitiseInput(args.content);

		if (!sanitisedTitle || !sanitisedContent) {
			return {
				status: "error",
				name: "create_note",
				content: "Missing title or content",
				data: {},
			};
		}

		const response = await insertEmbedding({
			request: {
				type: "note",
				...args,
			},
			env: req.env,
			user: req.user,
		});

		if (!response.data) {
			return {
				status: "error",
				name: "create_note",
				content: "Error creating note",
				data: {},
			};
		}

		return {
			status: "success",
			name: "create_note",
			content: "Note created successfully",
			data: response.data,
		};
	},
};
