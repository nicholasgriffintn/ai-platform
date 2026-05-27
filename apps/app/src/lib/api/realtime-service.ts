import { fetchApiOrThrow, returnFetchedData } from "./fetch-wrapper";
import type { CreateRealtimeSessionOptions, RealtimeModality, RealtimeSession } from "../realtime";

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
	const params = new URLSearchParams();
	appendParam(params, "provider", options.provider);
	appendParam(params, "model", options.model);
	appendParam(params, "transport", options.transport);
	appendParam(params, "language", options.language);
	appendParam(params, "source_language", options.sourceLanguage);
	appendParam(params, "target_language", options.targetLanguage);
	appendParam(params, "voice", options.voice);
	appendParam(params, "instructions", options.instructions);
	appendParam(params, "delay", options.delay);
	appendModalities(params, "input_modalities", options.inputModalities);
	appendModalities(params, "output_modalities", options.outputModalities);

	const query = params.toString();
	return `/realtime/session/${options.type}${query ? `?${query}` : ""}`;
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
