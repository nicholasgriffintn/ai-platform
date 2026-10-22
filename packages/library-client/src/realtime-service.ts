import type {
  CreateRealtimeSessionOptions,
  RealtimeModality,
  RealtimeSession,
} from "@ngriffin_uk/polychat-library-realtime";
import type { RealtimeLiveProviderCatalogueResponse } from "@ngriffin_uk/polychat-schemas";

import { fetchApiOrThrow } from "./fetch-wrapper.js";
import { returnFetchedData } from "./http.js";
import { resource } from "./resource.js";

export async function fetchRealtimeLiveProviders(): Promise<RealtimeLiveProviderCatalogueResponse> {
  return {
    providers:
      await resource<RealtimeLiveProviderCatalogueResponse["providers"][number]>(
        "/realtime/providers",
      ).listAll(),
  };
}

function appendParam(params: URLSearchParams, key: string, value?: string): void {
  if (value) {
    params.set(key, value);
  }
}

function appendModalities(
  params: URLSearchParams,
  key: string,
  modalities?: RealtimeModality[],
): void {
  if (modalities?.length) {
    params.set(key, modalities.join(","));
  }
}

export function buildRealtimeSessionPath(options: CreateRealtimeSessionOptions): string {
  const params = new URLSearchParams({ type: options.type });

  appendParam(params, "provider", options.provider);
  appendParam(params, "model", options.model);
  appendParam(params, "transport", options.transport);
  appendParam(params, "language", options.language);
  appendParam(params, "target_language", options.targetLanguage);
  appendParam(params, "voice", options.voice);
  appendParam(params, "instructions", options.instructions);
  appendParam(params, "delay", options.delay);
  appendParam(params, "speakers", options.speakerLabels ? "true" : undefined);
  appendModalities(params, "input_modalities", options.inputModalities);
  appendModalities(params, "output_modalities", options.outputModalities);

  return `/realtime/sessions?${params.toString()}`;
}

export async function createRealtimeSession(
  options: CreateRealtimeSessionOptions,
): Promise<RealtimeSession> {
  const response = await fetchApiOrThrow(buildRealtimeSessionPath(options), {
    method: "POST",
    signal: options.signal,
    timeoutMs: options.timeoutMs,
  });

  return returnFetchedData<RealtimeSession>(response);
}
