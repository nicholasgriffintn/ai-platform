import type { ToolDeclaration } from "./declaration.js";

export interface BedrockToolDeclaration {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: { json: Record<string, unknown> };
  };
}

export interface AnthropicToolDeclaration {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ProviderToolDeclaration =
  | ToolDeclaration
  | BedrockToolDeclaration
  | AnthropicToolDeclaration;

export function toProviderToolDeclaration(
  provider: string,
  definition: ToolDeclaration,
): ProviderToolDeclaration {
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

export function toProviderToolDeclarations(
  provider: string,
  definitions: readonly ToolDeclaration[],
): ProviderToolDeclaration[] {
  return definitions.map((definition) => toProviderToolDeclaration(provider, definition));
}
