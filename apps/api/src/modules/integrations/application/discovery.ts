import {
  NATIVE_MCP_TOOL_NAME,
  type CapabilityDiscoveryItem,
  type IntegrationDefinition,
} from "@ngriffin_uk/polychat-schemas";

export function createNativeIntegrationDiscoveryItem(
  definition: IntegrationDefinition,
  access: {
    activatableToolIds: ReadonlySet<string>;
    enabledToolIds: ReadonlySet<string>;
  },
): CapabilityDiscoveryItem {
  return {
    id: `integration:${definition.id}`,
    kind: "integration",
    name: definition.name,
    description: definition.description,
    configured: definition.connected,
    state: definition.connected ? "ready" : "setup_required",
    reason: definition.connected
      ? "Your account is connected. Tool definitions and project grants are rechecked before every action."
      : "Connect your own account in Plugins before using this integration.",
    tags: ["mcp", "integration", ...definition.snapshot.tools.map((tool) => tool.name)],
    invocation: {
      toolName: NATIVE_MCP_TOOL_NAME,
      availableNow: definition.connected && access.activatableToolIds.has(NATIVE_MCP_TOOL_NAME),
      ...(!access.enabledToolIds.has(NATIVE_MCP_TOOL_NAME) &&
      access.activatableToolIds.has(NATIVE_MCP_TOOL_NAME)
        ? { autoActivate: true }
        : {}),
      instruction: `Call ${NATIVE_MCP_TOOL_NAME} with provider "${definition.id}" first to discover the exact granted tool schemas. Then use an exact operation and params from discovery. Every custom MCP action requires user approval.`,
    },
    ...(!definition.connected
      ? { setup: { kind: "integration" as const, integrationId: definition.id } }
      : {}),
  };
}
