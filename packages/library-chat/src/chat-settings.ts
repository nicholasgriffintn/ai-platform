import type { ChatSettings } from "./conversation-types.js";

export function discardOutdatedChatStore(): undefined {
  return undefined;
}

export function clearModelResponseSettings(settings: ChatSettings): ChatSettings {
  const {
    reasoning: _reasoning,
    service_tier: _serviceTier,
    verbosity: _verbosity,
    ...rest
  } = settings;

  return rest;
}
