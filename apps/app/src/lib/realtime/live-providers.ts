import {
	DEFAULT_REALTIME_LIVE_PROVIDER_ID,
	REALTIME_LIVE_PROVIDER_MANIFEST,
	type RealtimeLiveProviderManifestItem,
} from "@assistant/schemas";
import { defaultModel, isRealtimeSessionModel, isTextInputChatModel } from "~/lib/models";
import type { ModelConfig } from "~/types";
import type { CreateRealtimeSessionOptions, RealtimeTransport } from "./types";
import {
	REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG,
	type RealtimeLiveWebSocketConfig,
} from "./websocket-protocols";

export type RealtimeLiveProviderId = RealtimeLiveProviderManifestItem["id"];

export { DEFAULT_REALTIME_LIVE_PROVIDER_ID };

export interface RealtimeLiveProviderOption extends RealtimeLiveProviderManifestItem {
	transport: RealtimeTransport;
	defaultDelay?: CreateRealtimeSessionOptions["delay"];
	websocket?: RealtimeLiveWebSocketConfig;
}

export const REALTIME_LIVE_PROVIDER_OPTIONS: RealtimeLiveProviderOption[] =
	REALTIME_LIVE_PROVIDER_MANIFEST.map((provider) => ({
		...provider,
		websocket: REALTIME_LIVE_PROVIDER_WEBSOCKET_CONFIG[provider.id],
	}));

export function getRealtimeLiveProviderOption(provider: string): RealtimeLiveProviderOption {
	return (
		REALTIME_LIVE_PROVIDER_OPTIONS.find((option) => option.id === provider) ??
		REALTIME_LIVE_PROVIDER_OPTIONS[0]
	);
}

export function isRealtimeLiveProviderId(
	provider?: string | null,
): provider is RealtimeLiveProviderId {
	return REALTIME_LIVE_PROVIDER_OPTIONS.some((option) => option.id === provider);
}

export function getRealtimeLiveProviderIdForModel(
	model?: { provider?: string; supportsRealtimeSession?: boolean } | null,
): RealtimeLiveProviderId | undefined {
	if (!model?.supportsRealtimeSession || !isRealtimeLiveProviderId(model.provider)) {
		return undefined;
	}

	return model.provider;
}

export function getDefaultLiveModelId(provider: string): string {
	return getRealtimeLiveProviderOption(provider).defaultModelId;
}

export function isComposedRealtimeLiveProvider(provider: string): boolean {
	return getRealtimeLiveProviderOption(provider).liveMode === "composed";
}

export function waitsForRealtimeLiveProviderFinalEventOnStop(provider: string): boolean {
	return Boolean(
		getRealtimeLiveProviderOption(provider).websocket?.audioInput?.waitForFinalEventTypeOnStop,
	);
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

	const defaultChatModel = models[defaultModel];
	if (
		defaultChatModel &&
		!isRealtimeSessionModel(defaultChatModel) &&
		isTextInputChatModel(defaultChatModel)
	) {
		return defaultModel;
	}

	return Object.entries(models).find(
		([, model]) =>
			!model.hiddenFromDefaultList && !isRealtimeSessionModel(model) && isTextInputChatModel(model),
	)?.[0];
}

export function supportsRealtimeLiveVideoInput(provider: string): boolean {
	return Boolean(getRealtimeLiveProviderOption(provider).websocket?.videoInput);
}
