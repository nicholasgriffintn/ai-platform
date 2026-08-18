import { InlineSettingSelect } from "@ngriffin_uk/polychat-component-conversation";
import {
  formatVerbosityLabel,
  getDefaultVerbosity,
  getVerbosityOptions,
} from "@ngriffin_uk/polychat-library-chat/verbosity";
import {
  EMPTY_MODEL_CONFIG,
  formatReasoningLabel,
  getAvailableModels,
  getDefaultReasoningEffort,
  getReasoningOptions,
} from "@ngriffin_uk/polychat-schemas";
import { Brain, ListFilter } from "lucide-react";
import { useMemo } from "react";

import { useModels } from "~/hooks/useModels";
import { useWebLLMModels } from "~/hooks/useWebLLMModels";
import { useChatStore } from "~/state/stores/chatStore";
import type { ChatSettings, ReasoningEffort, VerbosityLevel } from "~/types";

interface InlineResponseControlsProps {
  isDisabled?: boolean;
}

export function InlineResponseControls({ isDisabled = false }: InlineResponseControlsProps) {
  const { chatMode, chatSettings, model, setChatSettings } = useChatStore();
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: chatMode === "local" });
  const availableModels = useMemo(
    () => getAvailableModels(apiModels, chatMode === "local", webLLMModels),
    [apiModels, chatMode, webLLMModels],
  );
  const selectedModelConfig = model ? availableModels[model] : undefined;

  const reasoningOptions = getReasoningOptions(selectedModelConfig);
  const defaultReasoning = getDefaultReasoningEffort(selectedModelConfig);
  const verbosityOptions = getVerbosityOptions(selectedModelConfig);
  const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);

  const selectedReasoning = chatSettings.reasoning?.effort ?? "";
  const selectedVerbosity = chatSettings.verbosity ?? "";

  const updateChatSettings = (settings: ChatSettings) => {
    setChatSettings(settings);
  };

  const handleReasoningChange = (value: ReasoningEffort | "") => {
    if (!value) {
      updateChatSettings({
        ...chatSettings,
        reasoning: undefined,
      });

      return;
    }

    updateChatSettings({
      ...chatSettings,
      reasoning: {
        ...chatSettings.reasoning,
        effort: value,
      },
    });
  };

  const handleVerbosityChange = (value: VerbosityLevel | "") => {
    updateChatSettings({
      ...chatSettings,
      verbosity: value || undefined,
    });
  };

  return (
    <div className="flex flex-shrink-0 items-center gap-1">
      {reasoningOptions.length > 0 && (
        <InlineSettingSelect<ReasoningEffort>
          id="inline-reasoning"
          label="Reasoning depth"
          icon={<Brain className="h-4 w-4" />}
          value={selectedReasoning || defaultReasoning}
          displayLabel={
            selectedReasoning
              ? formatReasoningLabel(selectedReasoning)
              : formatReasoningLabel(defaultReasoning)
          }
          options={reasoningOptions.map((option) => ({
            value: option,
            label: formatReasoningLabel(option),
          }))}
          isDisabled={isDisabled}
          onChange={handleReasoningChange}
        />
      )}
      <InlineSettingSelect<VerbosityLevel>
        id="inline-verbosity"
        label="Verbosity"
        icon={<ListFilter className="h-4 w-4" />}
        value={selectedVerbosity || defaultVerbosity}
        displayLabel={
          selectedVerbosity
            ? formatVerbosityLabel(selectedVerbosity)
            : formatVerbosityLabel(defaultVerbosity)
        }
        options={verbosityOptions.map((option) => ({
          value: option,
          label: formatVerbosityLabel(option),
        }))}
        isDisabled={isDisabled}
        onChange={handleVerbosityChange}
      />
    </div>
  );
}
