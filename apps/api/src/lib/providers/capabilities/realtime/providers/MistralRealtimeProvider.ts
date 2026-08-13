import { getRealtimeLiveProviderManifestItem } from "@ngriffin_uk/polychat-schemas";
import { getModelConfigByModel } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { generateId } from "~/utils/id";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	RealtimeProvider,
	RealtimeSessionRequest,
	RealtimeTranscriptionDelay,
} from "../index";
import { buildRealtimeProxyUrl } from "./proxyUrl";

export const DEFAULT_TRANSCRIPTION_MODEL =
	getRealtimeLiveProviderManifestItem("mistral").defaultModelId;
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
	realtime: [],
	translation: [],
	transcription: [DEFAULT_TRANSCRIPTION_MODEL],
};

const MISTRAL_REALTIME_PROXY_PATH = "/realtime/mistral/transcription";
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const MISTRAL_TARGET_DELAY_MS_BY_DELAY: Record<NonNullable<RealtimeTranscriptionDelay>, number> = {
	minimal: 240,
	low: 500,
	medium: 1000,
	high: 2400,
	xhigh: 5000,
};

export function getMistralTargetStreamingDelayMs(
	delay?: RealtimeTranscriptionDelay,
): number | undefined {
	return delay ? MISTRAL_TARGET_DELAY_MS_BY_DELAY[delay] : undefined;
}

export class MistralRealtimeProvider implements RealtimeProvider {
	name = "mistral";

	private getProviderKeyName(): string {
		return "MISTRAL_API_KEY";
	}

	async getApiKey(request: RealtimeSessionRequest): Promise<string> {
		return resolveProviderApiKey({
			env: request.env,
			providerName: this.name,
			envKeyName: this.getProviderKeyName(),
			userId: request.user.id,
		});
	}

	getDefaultModel(type: RealtimeSessionRequest["type"]): string {
		if (type !== "transcription") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		return DEFAULT_TRANSCRIPTION_MODEL;
	}

	private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
		const requestedModel = request.model || this.getDefaultModel(request.type);
		const modelId = requestedModel;
		const supportedModels = SESSION_MODELS_BY_TYPE[request.type];

		if (!supportedModels.includes(requestedModel)) {
			throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
		}

		const modelConfig = await getModelConfigByModel(modelId, request.env);
		if (!modelConfig || modelConfig.provider !== this.name) {
			throw new AssistantError(
				`Model configuration not found for ${modelId}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return modelConfig.matchingModel;
	}

	buildAudioFormat(): Record<string, unknown> {
		return {
			encoding: "pcm_s16le",
			sample_rate: 16000,
		};
	}

	getTranscriptionDelay(request: RealtimeSessionRequest): RealtimeTranscriptionDelay {
		const delay = request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;
		if (!delay) {
			return undefined;
		}
		const TRANSCRIPTION_DELAYS = Object.keys(
			MISTRAL_TARGET_DELAY_MS_BY_DELAY,
		) as RealtimeTranscriptionDelay[];
		if (!TRANSCRIPTION_DELAYS.includes(delay)) {
			throw new AssistantError("Invalid transcription delay specified", ErrorType.PARAMS_ERROR);
		}

		return delay;
	}

	async createSession(request: RealtimeSessionRequest): Promise<unknown> {
		if (request.type !== "transcription") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		const model = await this.resolveModel(request);

		const targetStreamingDelayMs = getMistralTargetStreamingDelayMs(
			this.getTranscriptionDelay(request),
		);
		return {
			id: generateId(),
			object: "realtime.transcription.session",
			type: "transcription",
			provider: this.name,
			transport: "websocket",
			url: buildRealtimeProxyUrl({
				apiBaseUrl: request.apiBaseUrl ?? request.env.API_BASE_URL,
				path: MISTRAL_REALTIME_PROXY_PATH,
				params: { model, delay: request.delay },
			}),
			audio_format: this.buildAudioFormat(),
			input_audio_format: this.buildAudioFormat().encoding,
			input_audio_transcription: {
				model,
			},
			...(targetStreamingDelayMs ? { target_streaming_delay_ms: targetStreamingDelayMs } : {}),
		};
	}
}
