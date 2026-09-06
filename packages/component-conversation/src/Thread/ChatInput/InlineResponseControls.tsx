import { ShortcutTooltip, Toggle } from "@ngriffin_uk/polychat-component-ui";
import type {
  ChatSettings,
  VerbosityLevel,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  formatVerbosityLabel,
  getDefaultVerbosity,
  getVerbosityOptions,
} from "@ngriffin_uk/polychat-library-chat/verbosity";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useModels, useWebLLMModels } from "@ngriffin_uk/polychat-library-react";
import {
  EMPTY_MODEL_CONFIG,
  formatReasoningLabel,
  getAvailableModels,
  getDefaultReasoningEffort,
  getReasoningOptions,
} from "@ngriffin_uk/polychat-schemas";
import type { ReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import { Brain, ListFilter, Zap } from "lucide-react";
import { useMemo } from "react";

import { InlineSettingSelect } from "../../InlineSettingSelect";

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
  const supportsFastProcessing =
    selectedModelConfig?.supportedServiceTiers?.includes("fast") ?? false;
  const isFastProcessing = chatSettings.service_tier === "fast";
  const fastTierMultiplier = selectedModelConfig?.serviceTierMultipliers?.fast;

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
      {supportsFastProcessing && (
        <ShortcutTooltip
          keys={[]}
          label={`Fast processing${fastTierMultiplier ? ` (${fastTierMultiplier}× usage)` : ""}`}
        >
          <Toggle
            size="sm"
            pressed={isFastProcessing}
            disabled={isDisabled}
            aria-label="Fast processing"
            onPressedChange={(pressed) => {
              updateChatSettings({
                ...chatSettings,
                service_tier: pressed ? "fast" : undefined,
              });
            }}
            className="h-8 min-w-8 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:bg-selection hover:text-foreground data-[state=on]:bg-active-work/15 data-[state=on]:text-active-work"
          >
            <Zap className="h-4 w-4" aria-hidden="true" />
          </Toggle>
        </ShortcutTooltip>
      )}
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
          shortcut="/reasoning"
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
        shortcut="/verbosity"
        onChange={handleVerbosityChange}
      />
    </div>
  );
}
