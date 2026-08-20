import type { ToolDefinition } from "./define-tool";

export interface BedrockToolDefinition {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: { json: Record<string, unknown> };
  };
}

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ProviderToolDefinition =
  | ToolDefinition
  | BedrockToolDefinition
  | AnthropicToolDefinition;

/**
 * The one place a canonical tool definition becomes provider wire format.
 * Every runtime projects through this, so a provider that needs a different
 * envelope is changed here rather than in each caller's own formatter.
 */
export function toProviderToolDefinition(
  provider: string,
  definition: ToolDefinition,
): ProviderToolDefinition {
  const { name, description, parameters } = definition.function;

  if (provider === "bedrock") {
    return {
      toolSpec: {
        name,
        description,
        inputSchema: { json: parameters },
      },
    };
  }

  if (provider === "anthropic") {
    return {
      name,
      description,
      input_schema: parameters,
    };
  }

  return definition;
}

export function toProviderToolDefinitions(
  provider: string,
  definitions: readonly ToolDefinition[],
): ProviderToolDefinition[] {
  return definitions.map((definition) => toProviderToolDefinition(provider, definition));
}
