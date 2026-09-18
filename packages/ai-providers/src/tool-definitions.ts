import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  declareTool,
  flattenObjectRootSchema,
  isToolDeclaration,
  toProviderToolDeclarations,
  type ProviderToolDeclaration,
  type ToolDeclaration,
} from "@ngriffin_uk/polychat-library-tools";
import z from "zod/v4";

const logger = getLogger({ prefix: "lib/chat/tools/provider-tool-definitions" });

export interface FunctionToolDefinitionLike {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  inputSchema?: unknown;
  type?: string;
  permissions?: string[];
}

export type ToolDefinitionLike = ToolDeclaration | FunctionToolDefinitionLike;

export function getToolDefinitionLikeName(tool: ToolDefinitionLike): string {
  return isToolDeclaration(tool) ? tool.function.name : tool.name;
}

export function formatToolCalls(
  provider: string,
  functions: readonly ToolDefinitionLike[],
): ProviderToolDeclaration[] {
  if (!functions || !Array.isArray(functions)) {
    logger.warn("Invalid functions provided to formatToolCalls");

    return [];
  }

  const definitions = functions
    .map((func) => toCanonicalToolDefinition(func))
    .filter((definition): definition is ToolDeclaration => definition !== null);

  return toProviderToolDeclarations(provider, definitions);
}

function toCanonicalToolDefinition(func: unknown): ToolDeclaration | null {
  if (isToolDeclaration(func)) {
    return func;
  }

  const candidate = func as {
    name?: string;
    description?: string;
    parameters?: { jsonSchema?: Record<string, unknown> } & Record<string, unknown>;
    inputSchema?: unknown;
  };

  if (!candidate?.name) {
    logger.warn("Skipping tool definition without a name");

    return null;
  }

  const parameters = resolveFunctionParameters(candidate);

  if (!parameters) {
    logger.warn(`Missing parameters for function ${candidate.name}`);

    return null;
  }

  return declareTool({
    name: candidate.name,
    description: candidate.description ?? "",
    schema: parameters,
  });
}

function resolveFunctionParameters(func: {
  name?: string;
  parameters?: { jsonSchema?: Record<string, unknown> } & Record<string, unknown>;
  inputSchema?: unknown;
}): Record<string, unknown> | null {
  if (func.parameters) {
    return func.parameters.jsonSchema || func.parameters;
  }

  if (!func.inputSchema) {
    return null;
  }

  try {
    return flattenObjectRootSchema(z.toJSONSchema(func.inputSchema as z.ZodType));
  } catch (error) {
    logger.warn("Failed to convert tool input schema to JSON schema", {
      name: func.name,
      error_message: error instanceof Error ? error.message : "Unknown error",
    });

    return null;
  }
}
