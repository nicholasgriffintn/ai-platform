import type { ModelToolDefinition } from "./apps";
import {
  fileSearchToolConfigurationSchema,
  mcpToolConfigurationSchema,
  type FileSearchToolConfiguration,
  type McpToolConfiguration,
} from "./tool-configurations";

export type ModelToolConfiguration = FileSearchToolConfiguration | McpToolConfiguration;

export function parseModelToolConfiguration(
  tool: ModelToolDefinition,
  configuration: unknown,
): ModelToolConfiguration | null {
  if (tool.configurationKind === "file_search") {
    const parsed = fileSearchToolConfigurationSchema.safeParse(configuration);

    return parsed.success ? parsed.data : null;
  }

  if (tool.configurationKind === "mcp") {
    const parsed = mcpToolConfigurationSchema.safeParse(configuration);

    return parsed.success ? parsed.data : null;
  }

  return null;
}
