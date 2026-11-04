import {
  CAPABILITY_DISCOVERY_TOOL_NAME,
  capabilityDiscoveryKindSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const inputSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe("Natural-language use case or capability name to search for."),
  kinds: z
    .union([capabilityDiscoveryKindSchema, z.array(capabilityDiscoveryKindSchema).max(3)])
    .optional()
    .catch(undefined)
    .describe("Optional capability families to include."),
  configured: z
    .boolean()
    .optional()
    .catch(undefined)
    .describe(
      "Connectors and recipes only: true for configured, false for needing setup. Leave unset unless the person asks.",
    ),
  limit: z.number().int().min(1).max(20).default(8).optional().catch(8),
});

export const discover_capabilities: FunctionToolDescriptor = {
  name: CAPABILITY_DISCOVERY_TOOL_NAME,
  description:
    "Search tools, recipes, and connectors for a use case, including capabilities that need setup. Check here before web_search when a dedicated tool might exist, such as film and TV, cinema listings, weather or travel. Follow each result's invocation.toolName and instruction exactly; never invent a tool name or claim an unavailable invocation can run. This is read-only, so let the user complete suggested setup in the chat UI.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema,
};
