import type { ChatHostedToolSettings } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { MODEL_TOOL_DEFINITIONS } from "~/modules/experiences/application/config";
import { listFunctionToolDefinitions } from "~/modules/functions/application/definitions";
import {
  getModelToolDefinition,
  resolveModelToolConfigurations,
  validateModelToolConfiguration,
} from "~/modules/tools/application/modelToolConfiguration";
import type { ProjectCapabilityRow } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { resolveProjectRecipeConnectorScope } from "./projectRecipeConnectorScope";

interface ResolvedProjectTools {
  enabledTools: string[];
  toolOptions?: ChatHostedToolSettings;
}

function getCallableToolIds(): Set<string> {
  return new Set(listFunctionToolDefinitions().map((tool) => tool.name));
}

export function validateProjectToolConfiguration(
  toolId: string,
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  const definition = getModelToolDefinition(toolId);

  if (!definition) {
    if (getCallableToolIds().has(toolId)) {
      return {};
    }

    throw new AssistantError("Unknown project tool", ErrorType.PARAMS_ERROR, 400);
  }

  if (!definition.requiresConfiguration) {
    return {};
  }

  return validateModelToolConfiguration(toolId, configuration);
}

export function resolveProjectTools(capabilities: ProjectCapabilityRow[]): ResolvedProjectTools {
  const callableToolIds = getCallableToolIds();

  capabilities = capabilities.filter((capability) => !capability.excluded);
  const enabledTools = capabilities
    .filter(
      (capability) => capability.kind === "tool" && callableToolIds.has(capability.capability_id),
    )
    .map((capability) => capability.capability_id);
  const configuredModelTools = resolveModelToolConfigurations(
    capabilities
      .filter((capability) => capability.kind === "tool")
      .map((capability) => ({
        toolId: capability.capability_id,
        configuration: capability.configuration,
      })),
  );

  for (const definition of MODEL_TOOL_DEFINITIONS) {
    if (!definition.requiresConfiguration) {
      enabledTools.push(definition.id);
    }
  }

  enabledTools.push(...configuredModelTools.configuredToolIds);

  if (resolveProjectRecipeConnectorScope(capabilities).providers.length > 0) {
    enabledTools.push("use_recipe_connector");
  }

  return {
    enabledTools: [...new Set(enabledTools)],
    ...(configuredModelTools.toolOptions ? { toolOptions: configuredModelTools.toolOptions } : {}),
  };
}
