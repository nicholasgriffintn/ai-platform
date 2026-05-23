import { getModelConfigByModel } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { createProviderResponseError } from "~/lib/providers/utils/errors";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	RealtimeProvider,
	RealtimeSessionRequest,
	RealtimeTranscriptionDelay,
} from "../index";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
const DEFAULT_TRANSLATION_MODEL = "gpt-realtime-translate";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
const MODEL_ALIASES: Record<string, string> = {
	whisper: "openai-whisper",
};
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
	realtime: [DEFAULT_REALTIME_MODEL, "gpt-realtime-mini"],
	translation: [DEFAULT_TRANSLATION_MODEL],
	transcription: [
		DEFAULT_TRANSCRIPTION_MODEL,
		"gpt-4o-transcribe",
		"gpt-4o-mini-transcribe",
		"openai-whisper",
		"whisper",
	],
};
const REALTIME_WHISPER_MODEL = "gpt-realtime-whisper";
const DEFAULT_VOICE = "marin";
const DEFAULT_TRANSCRIPTION_DELAY: RealtimeTranscriptionDelay = "low";
const TRANSCRIPTION_DELAYS: RealtimeTranscriptionDelay[] = [
	"minimal",
	"low",
	"medium",
	"high",
	"xhigh",
];

const TRANSCRIPTION_TURN_DETECTION = {
	type: "server_vad",
	threshold: 0.4,
	prefix_padding_ms: 400,
	silence_duration_ms: 1000,
};

interface OpenAIRealtimeClientSecretResponse {
	value: string;
	expires_at: number;
	session?: Record<string, unknown> & {
		id?: string;
	};
}

export class OpenAIRealtimeProvider implements RealtimeProvider {
	name = "openai";
	models = [
		DEFAULT_REALTIME_MODEL,
		"gpt-realtime-mini",
		DEFAULT_TRANSLATION_MODEL,
		DEFAULT_TRANSCRIPTION_MODEL,
		"gpt-4o-transcribe",
		"gpt-4o-mini-transcribe",
		"openai-whisper",
		"whisper",
	];

	private getProviderKeyName(): string {
		return "OPENAI_API_KEY";
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
		switch (type) {
			case "realtime":
				return DEFAULT_REALTIME_MODEL;
			case "translation":
				return DEFAULT_TRANSLATION_MODEL;
			case "transcription":
				return DEFAULT_TRANSCRIPTION_MODEL;
		}
	}

	private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
		const requestedModel = request.model || this.getDefaultModel(request.type);
		const modelId = MODEL_ALIASES[requestedModel] ?? requestedModel;
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
			type: "audio/pcm",
			rate: 24000,
		};
	}

	getTranscriptionDelay(request: RealtimeSessionRequest): RealtimeTranscriptionDelay {
		const delay = request.delay ?? DEFAULT_TRANSCRIPTION_DELAY;
		if (!TRANSCRIPTION_DELAYS.includes(delay)) {
			throw new AssistantError("Invalid transcription delay specified", ErrorType.PARAMS_ERROR);
		}

		return delay;
	}

	private async buildTranscriptionSessionBody(
		request: RealtimeSessionRequest,
	): Promise<Record<string, unknown>> {
		const model = await this.resolveModel(request);
		const transcription =
			model === REALTIME_WHISPER_MODEL
				? {
						model,
						language: request.language ?? "en",
						delay: this.getTranscriptionDelay(request),
					}
				: {
						model,
						language: request.language ?? "en",
					};

		return {
			session: {
				type: "transcription",
				audio: {
					input: {
						format: {
							...this.buildAudioFormat(),
						},
						transcription,
						turn_detection: model === REALTIME_WHISPER_MODEL ? null : TRANSCRIPTION_TURN_DETECTION,
					},
				},
			},
		};
	}

	private async buildRealtimeSessionBody(
		request: RealtimeSessionRequest,
	): Promise<Record<string, unknown>> {
		const model = await this.resolveModel(request);

		return {
			session: {
				type: "realtime",
				model,
				...(request.instructions ? { instructions: request.instructions } : {}),
				audio: {
					input: {
						format: this.buildAudioFormat(),
						turn_detection: TRANSCRIPTION_TURN_DETECTION,
					},
					output: {
						format: this.buildAudioFormat(),
						voice: request.voice ?? DEFAULT_VOICE,
					},
				},
			},
		};
	}

	private async buildTranslationSessionBody(
		request: RealtimeSessionRequest,
	): Promise<Record<string, unknown>> {
		const model = await this.resolveModel(request);

		return {
			session: {
				type: "translation",
				model,
				audio: {
					input: {
						format: this.buildAudioFormat(),
					},
					output: {
						format: this.buildAudioFormat(),
						voice: request.voice ?? DEFAULT_VOICE,
					},
				},
				translation: {
					source_language: request.sourceLanguage ?? request.language,
					target_language: request.targetLanguage ?? "en",
				},
			},
		};
	}

	private normalizeClientSecretResponse(response: OpenAIRealtimeClientSecretResponse) {
		const session = response.session;
		return {
			...session,
			client_secret: {
				value: response.value,
				expires_at: response.expires_at,
			},
		};
	}

	async createSession(request: RealtimeSessionRequest): Promise<unknown> {
		if (
			request.type !== "realtime" &&
			request.type !== "translation" &&
			request.type !== "transcription"
		) {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		const apiKey = await this.getApiKey(request);
		const body =
			request.type === "realtime"
				? await this.buildRealtimeSessionBody(request)
				: request.type === "translation"
					? await this.buildTranslationSessionBody(request)
					: await this.buildTranscriptionSessionBody(request);
		const endpoint =
			request.type === "translation"
				? "https://api.openai.com/v1/realtime/translations/client_secrets"
				: "https://api.openai.com/v1/realtime/client_secrets";

		const response = await fetch(endpoint, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw await createProviderResponseError(response, "Failed to create realtime session");
		}

		const clientSecret = (await response.json()) as OpenAIRealtimeClientSecretResponse;
		return this.normalizeClientSecretResponse(clientSecret);
	}
}
