import type { IFunction, IRequest } from "../../types";
import { queryEmbeddings } from "../apps/embeddings/query";

export const get_note: IFunction = {
	name: "get_note",
	description:
		"Get a note from a query, only use this if the user has explicitly asked to get a saved note",
	parameters: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The query to search for",
			},
		},
		required: ["query"],
	},
	function: async (
		completion_id: string,
		args: any,
		req: IRequest,
		appUrl?: string,
	) => {
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
				type: "note",
				...args,
			},
			env: req.env,
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
