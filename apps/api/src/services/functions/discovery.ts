import type { ConversationManager } from "~/lib/conversationManager";
import type { IRequest } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";
import { AssistantError, ErrorType } from "~/utils/errors";
import z from "zod/v4";
import { listFunctionTools } from "./index";

export const search_functions: ApiToolDefinition = {
	name: "search_functions",
	description:
		"Search available functions by keywords or description. Use this to discover what capabilities are available when you're unsure which function to use.",
	type: "normal",
	costPerCall: 0,
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			query: {
				type: "string",
				description:
					"Search query - can be keywords, use cases, or natural language description of what you want to do",
			},
			limit: {
				type: "number",
				description: "Maximum number of results to return",
				default: 10,
			},
			include_premium: {
				type: "boolean",
				description: "Whether to include premium functions in results",
				default: true,
			},
		},
		required: ["query"],
	}),
	execute: async (args, context) => {
		const req = context.request;

		const { query, limit = 10, include_premium = true } = args;

		if (!query || typeof query !== "string" || query.trim().length === 0) {
			throw new AssistantError(
				"Query parameter is required and must be a non-empty string",
				ErrorType.PARAMS_ERROR,
			);
		}

		const isProUser = req.user?.plan_id === "pro";
		const searchTerms = query.toLowerCase().split(/\s+/);
		const availableFunctions = listFunctionTools();

		const scoredFunctions = availableFunctions
			.filter((fn) => {
				if (!fn || !fn.name) {
					return false;
				}
				if (fn.type === "premium" && !isProUser && !include_premium) {
					return false;
				}
				return true;
			})
			.map((fn) => {
				let score = 0;

				for (const term of searchTerms) {
					if (fn.name.toLowerCase().includes(term)) {
						score += 10;
					}
					if (fn.description.toLowerCase().includes(term)) {
						score += 5;
					}
				}

				if (fn.name.toLowerCase() === query.toLowerCase()) {
					score += 50;
				}

				if (fn.isDefault) {
					score += 2;
				}

				return { function: fn, score };
			})
			.filter((item) => item.score > 0)
			.sort((a, b) => b.score - a.score)
			.slice(0, Math.max(1, Math.min(limit, 50)));

		const results = scoredFunctions.map(({ function: fn }) => ({
			name: fn.name,
			description: fn.description,
			type: fn.type,
			costPerCall: fn.costPerCall,
			isDefault: fn.isDefault || false,
			parameters: z.toJSONSchema(fn.inputSchema),
			available: fn.type === "normal" || isProUser,
		}));

		return {
			name: "search_functions",
			status: "success",
			content: `Found ${results.length} function${results.length === 1 ? "" : "s"} matching "${query}"`,
			data: {
				query,
				results,
				total_available: availableFunctions.length,
				is_pro_user: isProUser,
			},
		};
	},
};

export const get_function_schema: ApiToolDefinition = {
	name: "get_function_schema",
	description:
		"Retrieve the complete schema and documentation for a specific function. Use this to understand the exact parameters, types, and requirements before calling a function.",
	type: "normal",
	costPerCall: 0,
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			function_name: {
				type: "string",
				description: "The exact name of the function to retrieve schema for",
			},
		},
		required: ["function_name"],
	}),
	execute: async (args, context) => {
		const req = context.request;

		const { function_name } = args;

		if (
			!function_name ||
			typeof function_name !== "string" ||
			function_name.trim().length === 0
		) {
			throw new AssistantError(
				"function_name parameter is required and must be a non-empty string",
				ErrorType.PARAMS_ERROR,
			);
		}

		const availableFunctions = listFunctionTools();
		const foundFunction = availableFunctions.find(
			(fn) => fn && fn.name === function_name,
		);

		if (!foundFunction) {
			return {
				name: "get_function_schema",
				status: "error",
				content: `Function "${function_name}" not found. Use search_functions to discover available functions.`,
				data: {
					function_name,
					available_functions: availableFunctions
						.filter((fn) => fn && fn.name)
						.map((fn) => fn.name),
				},
			};
		}

		const isProUser = req.user?.plan_id === "pro";
		const isAvailable = foundFunction.type === "normal" || isProUser;

		return {
			name: "get_function_schema",
			status: "success",
			content: `Retrieved schema for function "${function_name}"`,
			data: {
				name: foundFunction.name,
				description: foundFunction.description,
				type: foundFunction.type,
				costPerCall: foundFunction.costPerCall,
				isDefault: foundFunction.isDefault || false,
				strict: foundFunction.strict,
				parameters: z.toJSONSchema(foundFunction.inputSchema),
				available: isAvailable,
				requires_upgrade: !isAvailable,
			},
		};
	},
};
