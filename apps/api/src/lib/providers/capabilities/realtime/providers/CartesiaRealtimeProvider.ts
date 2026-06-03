import { getRealtimeLiveProviderManifestItem } from "@assistant/schemas";
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

const DEFAULT_TRANSCRIPTION_MODEL = getRealtimeLiveProviderManifestItem("cartesia").defaultModelId;
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
	realtime: [],
	translation: [],
	transcription: [DEFAULT_TRANSCRIPTION_MODEL],
};
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const CARTESIA_REALTIME_PROXY_PATH = "/realtime/cartesia/transcription";

export class CartesiaRealtimeProvider implements RealtimeProvider {
	name = "cartesia";
	models = SESSION_MODELS_BY_TYPE.transcription;

	async getApiKey(request: RealtimeSessionRequest): Promise<string> {
		return resolveProviderApiKey({
			env: request.env,
			providerName: this.name,
			envKeyName: "CARTESIA_API_KEY",
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
		if (!SESSION_MODELS_BY_TYPE[request.type].includes(requestedModel)) {
			throw new AssistantError("Invalid model specified", ErrorType.PARAMS_ERROR);
		}

		const modelConfig = await getModelConfigByModel(requestedModel, request.env);
		if (!modelConfig || modelConfig.provider !== this.name) {
			throw new AssistantError(
				`Model configuration not found for ${requestedModel}`,
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
		return request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;
	}

	async createSession(request: RealtimeSessionRequest): Promise<unknown> {
		if (request.type !== "transcription") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		const model = await this.resolveModel(request);
		const delay = this.getTranscriptionDelay(request);

		return {
			id: generateId(),
			object: "realtime.transcription.session",
			type: "transcription",
			provider: this.name,
			transport: "websocket",
			url: buildRealtimeProxyUrl({
				apiBaseUrl: request.apiBaseUrl ?? request.env.API_BASE_URL,
				path: CARTESIA_REALTIME_PROXY_PATH,
				params: { model, delay },
			}),
			audio_format: this.buildAudioFormat(),
			input_audio_format: this.buildAudioFormat().encoding,
			input_audio_transcription: {
				model,
				...(request.language ? { language: request.language } : {}),
			},
		};
	}
}
