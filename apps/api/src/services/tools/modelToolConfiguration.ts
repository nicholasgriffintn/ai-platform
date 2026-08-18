import {
  fileSearchToolConfigurationSchema,
  mcpToolConfigurationSchema,
  type ChatHostedToolSettings,
  type ModelToolDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseJsonRecord } from "~/utils/json";

export interface StoredModelToolConfiguration {
  toolId: string;
  configuration: string | Record<string, unknown> | null;
}

interface ResolvedModelToolConfigurations {
  configuredToolIds: string[];
  toolOptions?: ChatHostedToolSettings;
}

export function getModelToolDefinition(toolId: string): ModelToolDefinition | undefined {
  return MODEL_TOOL_DEFINITIONS.find((tool) => tool.id === toolId);
}

export function parseStoredModelToolConfiguration(
  configuration: StoredModelToolConfiguration["configuration"],
): Record<string, unknown> {
  return typeof configuration === "string" ? parseJsonRecord(configuration) : (configuration ?? {});
}

export function validateModelToolConfiguration(
  toolId: string,
  configuration: Record<string, unknown>,
): Record<string, unknown> {
  const definition = getModelToolDefinition(toolId);

  if (!definition?.requiresConfiguration) {
    throw new AssistantError(
      definition ? `${definition.label} does not accept configuration` : "Unknown model tool",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  const result =
    definition.configurationKind === "file_search"
      ? fileSearchToolConfigurationSchema.safeParse(configuration)
      : definition.configurationKind === "mcp"
        ? mcpToolConfigurationSchema.safeParse(configuration)
        : null;

  if (!result?.success) {
    throw new AssistantError(
      `${definition.label} configuration is incomplete`,
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return result.data;
}

export function resolveModelToolConfigurations(
  configurations: readonly StoredModelToolConfiguration[],
): ResolvedModelToolConfigurations {
  const byToolId = new Map(configurations.map((item) => [item.toolId, item.configuration]));
  const configuredToolIds: string[] = [];
  const toolOptions: ChatHostedToolSettings = {};

  for (const definition of MODEL_TOOL_DEFINITIONS) {
    if (!definition.requiresConfiguration || !byToolId.has(definition.id)) {
      continue;
    }

    const configuration = parseStoredModelToolConfiguration(byToolId.get(definition.id) ?? null);

    if (definition.configurationKind === "file_search") {
      const parsed = fileSearchToolConfigurationSchema.safeParse(configuration);

      if (!parsed.success) {
        continue;
      }

      configuredToolIds.push(definition.id);
      toolOptions.file_search = { vector_store_ids: parsed.data.vectorStoreIds };
    }

    if (definition.configurationKind === "mcp") {
      const parsed = mcpToolConfigurationSchema.safeParse(configuration);

      if (!parsed.success) {
        continue;
      }

      configuredToolIds.push(definition.id);
      toolOptions.mcp_servers = parsed.data.servers.map((server) => ({
        require_approval: "always",
        server_label: server.label,
        server_url: new URL(server.url).toString(),
      }));
    }
  }

  return {
    configuredToolIds,
    ...(Object.keys(toolOptions).length > 0 ? { toolOptions } : {}),
  };
}

export function mergePersonalModelToolOptions(params: {
  configured: ResolvedModelToolConfigurations;
  requestedEnabledTools?: readonly string[];
  requestedToolOptions?: ChatHostedToolSettings;
}): ChatHostedToolSettings | undefined {
  const enabledToolIds = new Set(params.requestedEnabledTools ?? []);
  const configuredOptions = params.configured.toolOptions;
  const toolOptions: ChatHostedToolSettings = { ...params.requestedToolOptions };

  if (enabledToolIds.has("file_search") && configuredOptions?.file_search) {
    toolOptions.file_search = configuredOptions.file_search;
  }

  if (enabledToolIds.has("mcp") && configuredOptions?.mcp_servers) {
    toolOptions.mcp_servers = configuredOptions.mcp_servers;
  }

  return Object.keys(toolOptions).length > 0 ? toolOptions : undefined;
}
