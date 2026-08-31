import {
  defineTool,
  flattenObjectRootSchema,
  isToolDefinition,
  toProviderToolDefinitions,
  type ProviderToolDefinition,
  type ToolDefinition,
} from "@ngriffin_uk/polychat-library-tool-runtime";
import z from "zod/v4";

import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/tools/provider-tool-definitions" });

export function formatToolCalls(provider: string, functions: unknown[]): ProviderToolDefinition[] {
  if (!functions || !Array.isArray(functions)) {
    logger.warn("Invalid functions provided to formatToolCalls");

    return [];
  }

  const definitions = functions
    .map((func) => toCanonicalToolDefinition(func))
    .filter((definition): definition is ToolDefinition => definition !== null);

  return toProviderToolDefinitions(provider, definitions);
}

function toCanonicalToolDefinition(func: unknown): ToolDefinition | null {
  if (isToolDefinition(func)) {
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

  return defineTool({
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
