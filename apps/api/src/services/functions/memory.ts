import {
	MEMORY_SEARCH_TOOL_NAME,
	MEMORY_STORE_TOOL_NAME,
	getEnabledMemoryToolNames,
} from "~/lib/chat/memoryPolicy";
import { sanitiseInput } from "~/lib/chat/utils";
import { MemoryManager } from "~/lib/memory";
import type { IUserSettings } from "~/types";
import { jsonSchemaToZod } from "./jsonSchema";
import type { ApiToolDefinition } from "./types";

async function getMemoryToolSettings(
	context: Parameters<ApiToolDefinition["execute"]>[1],
	toolName: string,
): Promise<{ userSettings?: IUserSettings | null; error?: string }> {
	if (!context.user?.id || context.user.plan_id !== "pro") {
		return { error: "Memory tools require a signed-in pro user." };
	}

	const userSettings = await context.request.context?.getUserSettings?.();
	if (!userSettings) {
		return { error: "Memory settings are not available for this request." };
	}

	if (
		!getEnabledMemoryToolNames({
			user: context.user,
			userSettings,
			store: true,
		}).includes(toolName)
	) {
		return { userSettings, error: "Memory tool is not enabled for this user." };
	}

	return { userSettings };
}

function errorResponse(name: string, content: string) {
	return {
		status: "error",
		name,
		content,
		data: {},
	};
}

export const search_memories: ApiToolDefinition = {
	name: MEMORY_SEARCH_TOOL_NAME,
	description:
		"Searches the user's long-term memory for relevant preferences, facts, or prior context. Use when personal context would improve the answer (or the user asks you to directly) and the user has memory enabled.",
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "The specific memory search query.",
			},
			top_k: {
				type: "integer",
				description: "The maximum number of memories to return.",
				minimum: 1,
				maximum: 10,
			},
		},
		required: ["query"],
	}),
	type: "premium",
	costPerCall: 0,
	permissions: ["read"],
	execute: async (args, context) => {
		const { userSettings, error } = await getMemoryToolSettings(context, MEMORY_SEARCH_TOOL_NAME);
		if (error) {
			return errorResponse(MEMORY_SEARCH_TOOL_NAME, error);
		}

		const query = sanitiseInput(args.query);
		if (!query) {
			return errorResponse(MEMORY_SEARCH_TOOL_NAME, "Missing memory search query.");
		}

		const topK =
			typeof args.top_k === "number" && Number.isFinite(args.top_k)
				? Math.max(1, Math.min(Math.floor(args.top_k), 10))
				: 5;

		const memoryManager = MemoryManager.getInstance(
			context.env,
			context.user,
			context.request.context,
		);
		const memories = await memoryManager.retrieveMemories(query, {
			topK,
			scoreThreshold: 0.5,
			userSettings,
		});

		return {
			status: "success",
			name: MEMORY_SEARCH_TOOL_NAME,
			content:
				memories.length > 0
					? memories.map((memory) => `- ${memory.text}`).join("\n")
					: "No relevant memories found.",
			data: { memories },
		};
	},
};

export const store_memory: ApiToolDefinition = {
	name: MEMORY_STORE_TOOL_NAME,
	description:
		"Stores a concise, durable memory about the user. Use only for stable user facts, preferences, or important context that should be remembered in future conversations, or if the user asks you to directly.",
	inputSchema: jsonSchemaToZod({
		type: "object",
		properties: {
			text: {
				type: "string",
				description: "A concise memory to store.",
			},
			category: {
				type: "string",
				description: "Optional memory category such as preference, fact, schedule, or general.",
			},
		},
		required: ["text"],
	}),
	type: "premium",
	costPerCall: 0,
	permissions: ["write"],
	execute: async (args, context) => {
		const { userSettings, error } = await getMemoryToolSettings(context, MEMORY_STORE_TOOL_NAME);
		if (error) {
			return errorResponse(MEMORY_STORE_TOOL_NAME, error);
		}

		const text = sanitiseInput(args.text);
		if (!text) {
			return errorResponse(MEMORY_STORE_TOOL_NAME, "Missing memory text.");
		}

		const category =
			typeof args.category === "string" && args.category.trim()
				? sanitiseInput(args.category).slice(0, 64)
				: "general";
		const completionId =
			context.request.request?.completion_id || context.completionId || undefined;

		const memoryManager = MemoryManager.getInstance(
			context.env,
			context.user,
			context.request.context,
		);
		const id = await memoryManager.storeMemory(
			text,
			{
				category,
				conversationId: completionId || "",
				timestamp: Date.now().toString(),
				source: "memory_tool",
			},
			completionId,
			userSettings,
		);

		if (!id) {
			return errorResponse(MEMORY_STORE_TOOL_NAME, "Memory could not be stored.");
		}

		return {
			status: "success",
			name: MEMORY_STORE_TOOL_NAME,
			content: "Memory stored.",
			data: { id },
		};
	},
};
