export interface ToolParameterSchema extends Record<string, unknown> {
  type: string;
}

export interface ToolDefinitionInput {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/**
 * The one place a provider-facing tool definition is shaped. Every agent
 * runtime describes its tools through this so the JSON schema sent to a model
 * cannot drift between them.
 */
export function defineTool(input: ToolDefinitionInput): ToolDefinition {
  const properties = input.parameters ?? {};
  const required = input.required ?? [];

  return {
    type: "function",
    function: {
      name: input.name,
      description: input.description,
      parameters: {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
      },
    },
  };
}

export function isToolDefinition(value: unknown): value is ToolDefinition {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as { type?: unknown; function?: unknown };

  if (candidate.type !== "function" || typeof candidate.function !== "object") {
    return false;
  }

  const fn = candidate.function as { name?: unknown };

  return typeof fn.name === "string";
}

export function getToolDefinitionNames(definitions: readonly ToolDefinition[]): string[] {
  return definitions.map((definition) => definition.function.name);
}
