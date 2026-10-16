import {
  createToolCatalogue,
  isToolError,
  requireToolEffects,
  requireToolPermissions,
  validateToolInput,
  type ToolCatalogue,
} from "@ngriffin_uk/polychat-library-tools";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import { fromToolError } from "~/infrastructure/errors";
import { createUseRecipeConnectorInputSchema } from "~/modules/recipes/application/tools/definitions/use_recipe_connector";
import type { ApiToolDefinition, FunctionToolDescriptor } from "~/types/functions";

export type RegisteredFunctionTool = ApiToolDefinition;

export interface FunctionToolCatalogueOptions {
  connectedConnectorProviders?: readonly RecipeConnectorProvider[];
  selectedConnectorProvider?: RecipeConnectorProvider;
}

interface ToolRegistration {
  listed?: boolean;
}

const registeredTools: RegisteredFunctionTool[] = [];
const unlistedToolNames = new Set<string>();

let cachedCatalogue: ToolCatalogue<RegisteredFunctionTool> | undefined;
let cachedDescriptors: FunctionToolDescriptor[] | undefined;

export function registerTools(
  tools: readonly RegisteredFunctionTool[],
  { listed = true }: ToolRegistration = {},
): void {
  registeredTools.push(...tools);

  if (!listed) {
    for (const tool of tools) {
      unlistedToolNames.add(tool.name);
    }
  }

  cachedCatalogue = undefined;
  cachedDescriptors = undefined;
}

export function getFunctionToolCatalogue(): ToolCatalogue<RegisteredFunctionTool> {
  cachedCatalogue ??= createToolCatalogue(
    registeredTools.map((tool) => ({
      ...tool,
      effects: requireToolEffects(tool.name, tool.effects),
    })),
  );

  return cachedCatalogue;
}

export function getFunctionToolDescriptors(): FunctionToolDescriptor[] {
  cachedDescriptors ??= registeredTools
    .filter((tool) => !unlistedToolNames.has(tool.name))
    .map((tool) => ({
      ...tool,
      permissions: requireToolPermissions(tool.name, tool.permissions),
      effects: requireToolEffects(tool.name, tool.effects),
    }));

  return cachedDescriptors;
}

export function applyConnectorScope<T extends FunctionToolDescriptor>(
  definitions: readonly T[],
  options?: FunctionToolCatalogueOptions,
): T[] {
  if (!options?.connectedConnectorProviders && !options?.selectedConnectorProvider) {
    return [...definitions];
  }

  const connectedConnectorProviders = options.connectedConnectorProviders;
  const connectorProviders = options.selectedConnectorProvider
    ? !connectedConnectorProviders ||
      connectedConnectorProviders.includes(options.selectedConnectorProvider)
      ? [options.selectedConnectorProvider]
      : []
    : [...(connectedConnectorProviders ?? [])];

  return definitions.flatMap((definition) => {
    if (definition.name !== "use_recipe_connector") {
      return [definition];
    }

    if (connectorProviders.length === 0) {
      return [];
    }

    return [
      {
        ...definition,
        inputSchema: createUseRecipeConnectorInputSchema(connectorProviders),
      },
    ];
  });
}

export function listFunctionToolDefinitions(
  options?: FunctionToolCatalogueOptions,
): FunctionToolDescriptor[] {
  return applyConnectorScope(getFunctionToolDescriptors(), options);
}

export const listFunctionTools = (
  options?: FunctionToolCatalogueOptions,
): RegisteredFunctionTool[] => applyConnectorScope(getFunctionToolCatalogue().list(), options);

export const resolveToolRepeatLimit = (functionName: string): number | undefined =>
  getFunctionToolCatalogue().repeatLimit(functionName);

export const expandFunctionToolNames = (toolNames: readonly string[]): string[] =>
  getFunctionToolCatalogue().expandCompanions(toolNames);

export const resolveFunctionTool = (functionName: string): RegisteredFunctionTool => {
  try {
    return getFunctionToolCatalogue().resolve(functionName);
  } catch (error) {
    throw isToolError(error) ? fromToolError(error) : error;
  }
};

export const validateFunctionArgs = (toolDefinition: RegisteredFunctionTool, args: unknown) => {
  try {
    return validateToolInput(toolDefinition, args);
  } catch (error) {
    throw isToolError(error) ? fromToolError(error) : error;
  }
};
