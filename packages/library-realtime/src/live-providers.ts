import {
  getDefaultModelId,
  isRealtimeSessionModel,
  isTextInputChatModel,
  type RealtimeLiveProviderCatalogueItem,
  type ModelConfig,
} from "@ngriffin_uk/polychat-schemas";

import type { CreateRealtimeSessionOptions, RealtimeTransport } from "./types";
import {
  REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG,
  type RealtimeLiveWebSocketConfig,
} from "./websocket-protocols";

export type RealtimeLiveProviderId = RealtimeLiveProviderCatalogueItem["id"];

export interface RealtimeLiveProviderOption extends RealtimeLiveProviderCatalogueItem {
  transport: RealtimeTransport;
  defaultDelay?: CreateRealtimeSessionOptions["delay"];
  websocket?: RealtimeLiveWebSocketConfig;
}

export function createRealtimeLiveProviderOptions(
  providers: RealtimeLiveProviderCatalogueItem[],
  websocketConfigs: Partial<
    Record<RealtimeLiveProviderId, RealtimeLiveWebSocketConfig>
  > = REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG,
): RealtimeLiveProviderOption[] {
  return providers.map((provider) => {
    const websocket = websocketConfigs[provider.id];

    if (provider.transport === "websocket" && !websocket) {
      return {
        ...provider,
        available: false,
        readiness: "unavailable",
        availabilityReason: `${provider.shortLabel} is not supported by this browser client.`,
      };
    }

    return { ...provider, websocket };
  });
}

export function getRealtimeLiveProviderOption(
  provider: string,
  options: RealtimeLiveProviderOption[] = [],
): RealtimeLiveProviderOption | undefined {
  return options.find((option) => option.id === provider);
}

export function getFirstReadyRealtimeLiveProviderOption(
  options: RealtimeLiveProviderOption[],
): RealtimeLiveProviderOption | undefined {
  return options.find((option) => option.readiness === "ready");
}

export function isRealtimeLiveProviderId(
  provider?: string | null,
  options: RealtimeLiveProviderOption[] = [],
): provider is RealtimeLiveProviderId {
  return options.some((option) => option.id === provider);
}

export function getRealtimeLiveProviderIdForModel(
  model?: { provider?: string; supportsRealtimeSession?: boolean } | null,
  options: RealtimeLiveProviderOption[] = [],
): RealtimeLiveProviderId | undefined {
  const provider = model?.provider
    ? getRealtimeLiveProviderOption(model.provider, options)
    : undefined;

  if (!model?.supportsRealtimeSession || provider?.readiness !== "ready") {
    return undefined;
  }

  return provider.id;
}

export function getDefaultLiveModelId(
  provider: string,
  options: RealtimeLiveProviderOption[] = [],
): string | undefined {
  return getRealtimeLiveProviderOption(provider, options)?.defaultModelId;
}

export function isComposedRealtimeLiveProvider(
  provider: string,
  options: RealtimeLiveProviderOption[] = [],
): boolean {
  return getRealtimeLiveProviderOption(provider, options)?.liveMode === "composed";
}

export function waitsForRealtimeLiveProviderFinalEventOnStop(
  provider: string,
  options: RealtimeLiveProviderOption[] = [],
): boolean {
  const audioInput = getRealtimeLiveProviderOption(provider, options)?.websocket?.audioInput;

  return Boolean(audioInput?.waitForFinalEventTypeOnStop || audioInput?.waitForSocketCloseOnStop);
}

export function getComposedRealtimeReasoningModelId(
  models: ModelConfig,
  selectedModelId?: string | null,
): string | undefined {
  const selectedModel = selectedModelId ? models[selectedModelId] : undefined;

  if (
    selectedModel &&
    !isRealtimeSessionModel(selectedModel) &&
    isTextInputChatModel(selectedModel)
  ) {
    return selectedModelId ?? undefined;
  }

  const defaultModelId = getDefaultModelId(models);
  const defaultChatModel = defaultModelId ? models[defaultModelId] : undefined;

  if (
    defaultChatModel &&
    !isRealtimeSessionModel(defaultChatModel) &&
    isTextInputChatModel(defaultChatModel)
  ) {
    return defaultModelId;
  }

  return undefined;
}

export function supportsRealtimeLiveVideoInput(
  provider: string,
  options: RealtimeLiveProviderOption[] = [],
): boolean {
  return Boolean(getRealtimeLiveProviderOption(provider, options)?.websocket?.videoInput);
}

export type RealtimeLiveStatus = "idle" | "connecting" | "active" | "error";

export interface RealtimeCameraDevice {
  deviceId: string;
  label: string;
}
