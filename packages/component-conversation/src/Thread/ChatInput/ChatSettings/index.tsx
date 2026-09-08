import type {
  ChatSettings as ChatSettingsType,
  VerbosityLevel,
} from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  getDefaultVerbosity,
  getVerbosityOptions,
} from "@ngriffin_uk/polychat-library-chat/verbosity";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import { useModels, useWebLLMModels } from "@ngriffin_uk/polychat-library-react";
import {
  EMPTY_MODEL_CONFIG,
  getAvailableModels,
  getDefaultReasoningEffort,
  getReasoningOptions,
} from "@ngriffin_uk/polychat-schemas";
import {
  getPermissionModeUnavailableReason,
  type PermissionMode,
  type ReasoningEffort,
} from "@ngriffin_uk/polychat-schemas";
import { useMemo, useState } from "react";

import { ChatSettingsPanel } from "../../../Composer/ChatSettingsPanel.js";

interface ChatSettingsProps {
  isDisabled?: boolean;
}

type NumericChatSettingKey =
  | "temperature"
  | "top_p"
  | "max_tokens"
  | "presence_penalty"
  | "frequency_penalty";

type ChatCompactionMode = NonNullable<ChatSettingsType["compaction"]>;
type ChatServiceTier = NonNullable<ChatSettingsType["service_tier"]>;

function isChatCompactionMode(value: string): value is ChatCompactionMode {
  return value === "auto" || value === "off";
}

function isChatServiceTier(value: string): value is ChatServiceTier {
  return value === "default" || value === "fast";
}

export const ChatSettings = ({ isDisabled = false }: ChatSettingsProps) => {
  const {
    chatMode,
    computeSite,
    chatSettings,
    isPro,
    model,
    setChatSettings,
    setUseMultiModel,
    useMultiModel,
    permissionMode,
    setPermissionMode,
  } = useChatStore();
  const [showSettings, setShowSettings] = useState(false);
  const { data: apiModels = EMPTY_MODEL_CONFIG } = useModels();
  const webLLMModels = useWebLLMModels({ enabled: computeSite === "browser" });
  const availableModels = useMemo(
    () => getAvailableModels(apiModels, computeSite === "browser", webLLMModels),
    [apiModels, computeSite, webLLMModels],
  );

  const activeModelId = model && model.length > 0 ? model : undefined;
  const selectedModelConfig = activeModelId ? availableModels[activeModelId] : undefined;

  const reasoningOptions = getReasoningOptions(selectedModelConfig);
  const defaultReasoningEffort = getDefaultReasoningEffort(selectedModelConfig);
  const verbosityOptions = getVerbosityOptions(selectedModelConfig);
  const defaultVerbosity = getDefaultVerbosity(selectedModelConfig);
  const showMultiModelToggle = isPro && !model && chatMode === "chat";
  const fastTierMultiplier = selectedModelConfig?.serviceTierMultipliers?.fast;
  const fastTierPrice = fastTierMultiplier ? ` at ${fastTierMultiplier}× token price` : "";
  const serviceTierDescription = selectedModelConfig?.matchingModel.startsWith("gpt-6-astra")
    ? `Automatic follows the OpenAI project default. Fast targets lower latency${fastTierPrice}, but is unavailable for Astra with EU data residency.`
    : `Automatic follows the OpenAI project default. Fast targets lower latency${fastTierPrice}.`;

  const handleNumericSettingChange = (key: NumericChatSettingKey, value: string) => {
    if (value.trim() === "") {
      const nextSettings = { ...chatSettings };

      delete nextSettings[key];
      setChatSettings(nextSettings);

      return;
    }

    const numValue = Number.parseFloat(value);

    if (Number.isNaN(numValue) || (key === "max_tokens" && numValue < 1)) {
      return;
    }

    setChatSettings({
      ...chatSettings,
      [key]: numValue,
    });
  };

  const permissionModeOptions: Array<{ label: string; value: PermissionMode }> = [
    {
      value: "supervised",
      label: getPermissionModeUnavailableReason(
        selectedModelConfig?.agent?.capabilities,
        "supervised",
        selectedModelConfig?.agent?.permissionModes,
      )
        ? "Supervised (unavailable)"
        : "Supervised",
    },
    {
      value: "auto_accept_edits",
      label: getPermissionModeUnavailableReason(
        selectedModelConfig?.agent?.capabilities,
        "auto_accept_edits",
        selectedModelConfig?.agent?.permissionModes,
      )
        ? "Auto-accept edits (unavailable)"
        : "Auto-accept edits",
    },
    {
      value: "auto",
      label: getPermissionModeUnavailableReason(
        selectedModelConfig?.agent?.capabilities,
        "auto",
        selectedModelConfig?.agent?.permissionModes,
      )
        ? "Auto (unavailable)"
        : "Auto",
    },
    {
      value: "full_access",
      label: getPermissionModeUnavailableReason(
        selectedModelConfig?.agent?.capabilities,
        "full_access",
        selectedModelConfig?.agent?.permissionModes,
      )
        ? "Full access (unavailable)"
        : "Full access",
    },
  ];
  const canUsePermissionMode = Boolean(
    selectedModelConfig?.agent?.capabilities.writesFiles ||
    selectedModelConfig?.agent?.capabilities.runsCommands,
  );
  const handlePermissionModeChange = (value: string) => {
    if (
      value === "supervised" ||
      value === "auto_accept_edits" ||
      value === "auto" ||
      value === "full_access"
    ) {
      if (
        !selectedModelConfig?.agent?.capabilities ||
        getPermissionModeUnavailableReason(
          selectedModelConfig.agent.capabilities,
          value,
          selectedModelConfig.agent.permissionModes,
        )
      ) {
        return;
      }

      setPermissionMode(value);
    }
  };

  const handleCompactionChange = (value: string) => {
    if (!isChatCompactionMode(value)) {
      return;
    }

    setChatSettings({
      ...chatSettings,
      compaction: value,
    });
  };

  const handleServiceTierChange = (value: string) => {
    if (value === "auto") {
      const nextSettings = { ...chatSettings };

      delete nextSettings.service_tier;
      setChatSettings(nextSettings);

      return;
    }

    if (!isChatServiceTier(value) || !selectedModelConfig?.supportedServiceTiers?.includes(value)) {
      return;
    }

    setChatSettings({
      ...chatSettings,
      service_tier: value,
    });
  };

  const handleReasoningEffortChange = (value: string) => {
    const nextValue = value as ReasoningEffort | "";

    if (!nextValue) {
      setChatSettings({
        ...chatSettings,
        reasoning: undefined,
      });

      return;
    }

    setChatSettings({
      ...chatSettings,
      reasoning: {
        ...chatSettings.reasoning,
        effort: nextValue,
      },
    });
  };

  const handleVerbosityChange = (value: string) => {
    const nextValue = value as VerbosityLevel | "";

    if (!nextValue) {
      setChatSettings({
        ...chatSettings,
        verbosity: undefined,
      });

      return;
    }

    setChatSettings({
      ...chatSettings,
      verbosity: nextValue,
    });
  };

  return (
    <ChatSettingsPanel
      showSettings={showSettings}
      onShowSettingsChange={setShowSettings}
      isDisabled={isDisabled}
      chatSettings={chatSettings}
      onChatSettingsChange={setChatSettings}
      reasoningOptions={reasoningOptions}
      verbosityOptions={verbosityOptions}
      selectedModelConfig={selectedModelConfig}
      defaultReasoningEffort={defaultReasoningEffort}
      defaultVerbosity={defaultVerbosity}
      maxOutputTokens={selectedModelConfig?.maxTokens}
      showMultiModelToggle={showMultiModelToggle}
      useMultiModel={useMultiModel}
      onUseMultiModelChange={setUseMultiModel}
      onNumericSettingChange={(key, value) =>
        handleNumericSettingChange(key as NumericChatSettingKey, value)
      }
      onCompactionChange={handleCompactionChange}
      onReasoningEffortChange={handleReasoningEffortChange}
      onServiceTierChange={handleServiceTierChange}
      serviceTierDescription={serviceTierDescription}
      onVerbosityChange={handleVerbosityChange}
      permissionMode={canUsePermissionMode ? permissionMode : undefined}
      permissionModeOptions={canUsePermissionMode ? permissionModeOptions : undefined}
      onPermissionModeChange={canUsePermissionMode ? handlePermissionModeChange : undefined}
    />
  );
};
