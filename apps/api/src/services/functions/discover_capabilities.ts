import {
	CAPABILITY_DISCOVERY_TOOL_NAME,
	capabilityDiscoveryKindSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { discoverAssistantCapabilities } from "~/services/assistant-capability-discovery";
import { loadCapabilityDiscoverySources } from "~/services/assistant-capability-discovery-sources";
import { createCapabilityDiscoveryResponse } from "~/services/assistant-capability-discovery-response";
import type { ApiToolDefinition } from "~/types/functions";

const inputSchema = z.object({
	query: z
		.string()
		.trim()
		.min(1)
		.max(200)
		.describe("Natural-language use case or capability name to search for."),
	kinds: z
		.array(capabilityDiscoveryKindSchema)
		.max(3)
		.optional()
		.describe("Optional capability families to include."),
	configured: z
		.boolean()
		.optional()
		.describe("Set true for configured capabilities or false for capabilities needing setup."),
	limit: z.number().int().min(1).max(20).default(8).optional(),
});

export const discover_capabilities: ApiToolDefinition = {
	name: CAPABILITY_DISCOVERY_TOOL_NAME,
	description:
		"Search tools, recipes, and connectors for a use case, including capabilities that need setup. Follow each result's invocation.toolName and instruction exactly; never invent a tool name or claim an unavailable invocation can run. This is read-only, so let the user complete suggested setup in the chat UI.",
	type: "normal",
	costPerCall: 0,
	isDefault: true,
	permissions: ["read"],
	inputSchema,
	execute: async (args, toolContext) => {
		const sources = await loadCapabilityDiscoverySources(toolContext.request);
		const result = discoverAssistantCapabilities(sources, args);

		return createCapabilityDiscoveryResponse(result);
	},
};
