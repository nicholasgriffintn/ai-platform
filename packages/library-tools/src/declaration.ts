export interface ToolDeclarationInput {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  required?: string[];
  schema?: Record<string, unknown>;
}

export interface ToolDeclaration {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function declareTool(input: ToolDeclarationInput): ToolDeclaration {
  const properties = input.parameters ?? {};
  const required = input.required ?? [];

  return {
    type: "function",
    function: {
      name: input.name,
      description: input.description,
      parameters: input.schema
        ? { type: "object", ...input.schema }
        : {
            type: "object",
            properties,
            ...(required.length > 0 ? { required } : {}),
          },
    },
  };
}

export function isToolDeclaration(value: unknown): value is ToolDeclaration {
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

export function getToolDeclarationNames(definitions: readonly ToolDeclaration[]): string[] {
  return definitions.map((definition) => definition.function.name);
}
