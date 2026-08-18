import type {
  ModelConfigItem,
  ModelToolCapability,
  ModelToolDefinition,
  ModelToolId,
} from "@ngriffin_uk/polychat-schemas";
import { modelToolIdSchema } from "@ngriffin_uk/polychat-schemas";

export type { ModelToolDefinition, ModelToolId } from "@ngriffin_uk/polychat-schemas";

export type ToolCapabilityKey = ModelToolCapability;
export type ModelToolModelCapabilities = Partial<
  Pick<ModelConfigItem, "supportsToolCalls" | ToolCapabilityKey>
>;

export interface ModelToolOption extends ModelToolDefinition {
  availabilityReason: string;
  available: boolean;
  requiredModelCapabilities: ToolCapabilityKey[];
}

export function isModelToolId(toolId: string): toolId is ModelToolId {
  return modelToolIdSchema.safeParse(toolId).success;
}

function unavailableModelToolReason(
  tool: ModelToolDefinition,
  model?: ModelToolModelCapabilities,
): string {
  if (!model) return "Select a model to see tool support.";
  if (!model.supportsToolCalls) return "The selected model does not support tools.";
  if (model[tool.capability] && tool.id === "mcp") {
    return "Configure MCP servers before enabling MCP.";
  }
  if (model[tool.capability] && tool.id === "file_search") {
    return "Configure vector stores before enabling file search.";
  }
  return `The selected model does not support ${tool.command}.`;
}

export function getModelToolOptions(
  model: ModelToolModelCapabilities | undefined,
  definitions: readonly ModelToolDefinition[],
): ModelToolOption[] {
  return definitions.map((tool) => {
    const available = Boolean(
      model?.supportsToolCalls && model[tool.capability] && !tool.requiresConfiguration,
    );
    return {
      ...tool,
      available,
      requiredModelCapabilities: [tool.capability],
      availabilityReason: available
        ? "Available for the selected model."
        : unavailableModelToolReason(tool, model),
    };
  });
}

export function getAvailableModelTools(
  model: ModelToolModelCapabilities | undefined,
  definitions: readonly ModelToolDefinition[],
): ModelToolOption[] {
  return getModelToolOptions(model, definitions).filter((tool) => tool.available);
}

const TOOL_CAPABILITIES: Record<ModelToolId, ToolCapabilityKey> = {
  code_execution: "supportsCodeExecution",
  file_search: "supportsFileSearch",
  hosted_shell: "supportsHostedShell",
  image_generation: "supportsImageGenerationTool",
  mcp: "supportsMcp",
  search_grounding: "supportsSearchGrounding",
  tool_search: "supportsToolSearch",
  web_fetch: "supportsWebFetch",
};

export function filterUnavailableModelToolSelections(
  selectedTools: string[],
  model?: ModelToolModelCapabilities,
): string[] {
  if (!model) return selectedTools;

  return selectedTools.filter((toolId) => {
    if (!isModelToolId(toolId)) return true;
    if (toolId === "mcp" || toolId === "file_search") return false;
    return Boolean(model.supportsToolCalls && model[TOOL_CAPABILITIES[toolId]]);
  });
}
