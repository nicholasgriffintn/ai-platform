import { ToolToggleMenu } from "@ngriffin_uk/polychat-component-conversation";
import type { ModelToolId } from "@ngriffin_uk/polychat-library-chat/model-tools";
import {
  Code,
  Database,
  Image,
  Layers,
  Link,
  ListFilter,
  Search,
  Terminal,
  type LucideIcon,
} from "lucide-react";

import { useModels } from "~/hooks/useModels";
import { useModelToolOptions } from "~/hooks/useModelTools";
import { useChatStore } from "~/state/stores/chatStore";
import { useToolsStore } from "~/state/stores/toolsStore";

interface ToolTogglesProps {
  isDisabled?: boolean;
  showHeading?: boolean;
}

const MODEL_TOOL_ICONS: Record<ModelToolId, LucideIcon> = {
  code_execution: Code,
  file_search: Database,
  hosted_shell: Terminal,
  image_generation: Image,
  mcp: ListFilter,
  search_grounding: Search,
  tool_search: ListFilter,
  web_fetch: Link,
};

export const ToolToggles = ({ isDisabled = false, showHeading = true }: ToolTogglesProps) => {
  const { model, chatMode, isPro, useMultiModel, setUseMultiModel } = useChatStore();
  const { selectedTools, setSelectedTools } = useToolsStore();
  const { data: apiModels } = useModels();

  const modelCapabilities = model ? apiModels?.[model] : undefined;
  const modelToolOptions = useModelToolOptions(modelCapabilities);

  const toggleTool = (toolName: string) => {
    setSelectedTools(
      selectedTools.includes(toolName)
        ? selectedTools.filter((selectedTool) => selectedTool !== toolName)
        : [...selectedTools, toolName],
    );
  };

  const showMultiModelToggle = isPro && !model && chatMode === "remote";

  if (!showMultiModelToggle && modelToolOptions.length === 0) {
    return null;
  }

  const menuOptions = [
    showMultiModelToggle
      ? {
          description: "Use multiple models when useful.",
          key: "multi-model",
          icon: <Layers className="h-5 w-5 shrink-0" aria-hidden="true" />,
          isDisabled: false,
          isPressed: useMultiModel,
          label: "Multi-model",
          onToggle: () => setUseMultiModel(!useMultiModel),
        }
      : null,
    ...modelToolOptions.map((tool) => {
      const Icon = MODEL_TOOL_ICONS[tool.id];

      return {
        description: tool.availabilityReason,
        isDisabled: !tool.available,
        key: tool.id,
        icon: <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />,
        isPressed: selectedTools.includes(tool.id),
        label: tool.label,
        onToggle: () => toggleTool(tool.id),
      };
    }),
  ].filter((option) => option !== null);

  return <ToolToggleMenu options={menuOptions} isDisabled={isDisabled} showHeading={showHeading} />;
};
