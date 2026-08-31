import { isRecord } from "@ngriffin_uk/polychat-utility-core";

import type { ChatSettings } from "~/types";

const LEGACY_SAMPLING_DEFAULTS: Record<string, number> = {
  temperature: 0.7,
  top_p: 0.8,
  presence_penalty: 0,
  frequency_penalty: 0,
};

export function migrateLegacySamplingDefaults(persistedState: unknown, version: number): unknown {
  if (version >= 2 || !isRecord(persistedState) || !isRecord(persistedState.chatSettings)) {
    return persistedState;
  }

  const chatSettings = { ...persistedState.chatSettings };
  const strippedKeys = Object.entries(LEGACY_SAMPLING_DEFAULTS).filter(
    ([key, legacyValue]) => chatSettings[key] === legacyValue,
  );

  if (strippedKeys.length === 0) {
    return persistedState;
  }

  for (const [key] of strippedKeys) {
    delete chatSettings[key];
  }

  return {
    ...persistedState,
    chatSettings,
  };
}

export function migrateChatStore(persistedState: unknown, version: number): unknown {
  return migrateLegacySamplingDefaults(
    migrateLegacyMaxOutputTokens(persistedState, version),
    version,
  );
}

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

export function clearModelResponseSettings(settings: ChatSettings): ChatSettings {
  const { reasoning: _reasoning, verbosity: _verbosity, ...rest } = settings;

  return rest;
}
