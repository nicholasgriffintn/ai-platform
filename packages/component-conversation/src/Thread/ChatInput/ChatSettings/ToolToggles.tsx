import { useToolsStore, useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useModels, useModelToolOptions } from "@ngriffin_uk/polychat-library-react";
import { Layers } from "lucide-react";

import { ToolToggleMenu } from "../../../ToolToggleMenu.js";
import { MODEL_TOOL_ICONS } from "../modelToolIcons.js";

interface ToolTogglesProps {
  isDisabled?: boolean;
  showHeading?: boolean;
}

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

  const showMultiModelToggle = isPro && !model && chatMode === "chat";

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
