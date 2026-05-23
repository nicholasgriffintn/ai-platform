import { queryEmbeddings } from "~/services/apps/embeddings/query";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

export const get_note: ApiToolDefinition = {
	name: "get_note",
	description:
		"Retrieves previously saved notes based on title, tags, or content search. Use when users reference earlier information, need to continue work on a project, or want to review saved material.",
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The query to search for",
			},
		},
		required: ["query"],
	}),
	type: "premium",
	costPerCall: 0,
	permissions: ["read"],
	execute: async (args, context) => {
		const req = context.request;

		if (!args.query) {
			return {
				status: "error",
				name: "get_note",
				content: "Missing query",
				data: {},
			};
		}

		const response = await queryEmbeddings({
			request: {
				query: {
					query: args.query,
					type: "note",
				},
			},
			env: req.env,
			user: req.user,
		});

		if (!response.data) {
			return {
				status: "error",
				name: "get_note",
				content: "Error getting note",
				data: {},
			};
		}

		return {
			status: "success",
			name: "get_note",
			content: "Notes retrieved successfully",
			data: response.data,
		};
	},
};
