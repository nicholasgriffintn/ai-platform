import { getDefaultVerbosity } from "@ngriffin_uk/polychat-library-chat/verbosity";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { getDefaultReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ChatSettings } from "~/types";

export function migrateLegacyMaxOutputTokens(persistedState: unknown, version: number): unknown {
  if (version >= 1 || !isRecord(persistedState) || !isRecord(persistedState.chatSettings)) {
    return persistedState;
  }

  if (persistedState.chatSettings.max_tokens !== 8_192) {
    return persistedState;
  }

  const { max_tokens: _legacyDefault, ...chatSettings } = persistedState.chatSettings;

  return {
    ...persistedState,
    chatSettings,
  };
}

export function applyModelResponseDefaults(
  settings: ChatSettings,
  modelConfig?: ModelConfigItem,
): ChatSettings {
  return {
    ...settings,
    reasoning: {
      ...settings.reasoning,
      effort: getDefaultReasoningEffort(modelConfig),
    },
    verbosity: getDefaultVerbosity(modelConfig),
  };
}
