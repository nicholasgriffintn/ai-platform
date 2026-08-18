import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps";

export const CAPABILITY_DISCOVERY_TOOL_NAME = "discover_capabilities";
export const CAPABILITY_DISCOVERY_DATA_KEY = "capabilityDiscovery";

export const capabilityDiscoveryKindSchema = z.enum(["tool", "recipe", "connector"]);
export const capabilityDiscoveryStateSchema = z.enum(["ready", "setup_required", "unavailable"]);

export const capabilityDiscoveryInvocationSchema = z.object({
  toolName: z.string().min(1),
  availableNow: z.boolean(),
  instruction: z.string().min(1),
});

export const capabilityDiscoverySetupSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("recipe"),
    recipeId: z.string().min(1),
  }),
  z.object({
    kind: z.literal("connector"),
    provider: recipeConnectorProviderSchema,
  }),
]);

export const capabilityDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  kind: capabilityDiscoveryKindSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  configured: z.boolean(),
  state: capabilityDiscoveryStateSchema,
  reason: z.string(),
  tags: z.array(z.string()).default([]),
  invocation: capabilityDiscoveryInvocationSchema,
  setup: capabilityDiscoverySetupSchema.optional(),
});

export const capabilityDiscoveryResultSchema = z.object({
  query: z.string(),
  items: z.array(capabilityDiscoveryItemSchema),
  total: z.number().int().nonnegative(),
  projectId: z.string().min(1).optional(),
});

export type CapabilityDiscoveryKind = z.infer<typeof capabilityDiscoveryKindSchema>;
export type CapabilityDiscoveryState = z.infer<typeof capabilityDiscoveryStateSchema>;
export type CapabilityDiscoveryInvocation = z.infer<typeof capabilityDiscoveryInvocationSchema>;
export type CapabilityDiscoverySetup = z.infer<typeof capabilityDiscoverySetupSchema>;
export type CapabilityDiscoveryItem = z.infer<typeof capabilityDiscoveryItemSchema>;
export type CapabilityDiscoveryResult = z.infer<typeof capabilityDiscoveryResultSchema>;
