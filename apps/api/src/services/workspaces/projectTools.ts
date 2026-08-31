import type { ChatHostedToolSettings } from "@ngriffin_uk/polychat-schemas";

import type { ProjectCapabilityRow } from "~/repositories/WorkspaceRepository";
import { MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { listFunctionToolDefinitions } from "~/services/functions/definitions";
import {
  getModelToolDefinition,
  resolveModelToolConfigurations,
  validateModelToolConfiguration,
} from "~/services/tools/modelToolConfiguration";
import { AssistantError, ErrorType } from "~/utils/errors";

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

  return {
    enabledTools: [...new Set(enabledTools)],
    ...(configuredModelTools.toolOptions ? { toolOptions: configuredModelTools.toolOptions } : {}),
  };
}
