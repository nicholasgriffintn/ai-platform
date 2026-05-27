import { getModelConfigByModel } from "~/lib/providers/models";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { createProviderResponseError } from "~/lib/providers/utils/errors";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	RealtimeProvider,
	RealtimeSessionType,
	RealtimeSessionRequest,
	RealtimeTranscriptionDelay,
} from "../index";
import {
	validateRealtimeModalities,
	type RealtimeModality,
	type RealtimeTransport,
} from "../modalities";

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2";
const DEFAULT_TRANSLATION_MODEL = "gpt-realtime-translate";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-realtime-whisper";
const OPENAI_WEBRTC_CALL_URL = "https://api.openai.com/v1/realtime/calls";
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
const DEFAULT_TRANSPORT: RealtimeTransport = "webrtc";
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

const SUPPORTED_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["text", "audio", "image"],
	translation: ["audio"],
	transcription: ["audio"],
};

const SUPPORTED_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["text", "audio"],
	translation: ["text", "audio"],
	transcription: ["text"],
};

const DEFAULT_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["text", "audio"],
	translation: ["audio"],
	transcription: ["audio"],
};

const DEFAULT_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["audio"],
	translation: ["text", "audio"],
	transcription: ["text"],
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

	private async getSafetyIdentifier(request: RealtimeSessionRequest): Promise<string> {
		return sha256Hex(`user:${request.user.id}`);
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

	private getTransport(request: RealtimeSessionRequest): RealtimeTransport {
		const transport = request.transport ?? DEFAULT_TRANSPORT;
		if (transport !== "webrtc") {
			throw new AssistantError("Unsupported realtime transport specified", ErrorType.PARAMS_ERROR);
		}

		return transport;
	}

	private getInputModalities(request: RealtimeSessionRequest): RealtimeModality[] {
		validateRealtimeModalities({
			requested: request.inputModalities,
			supported: SUPPORTED_INPUT_MODALITIES_BY_TYPE[request.type],
			label: "input",
		});

		return request.inputModalities ?? DEFAULT_INPUT_MODALITIES_BY_TYPE[request.type];
	}

	private getOutputModalities(request: RealtimeSessionRequest): RealtimeModality[] {
		validateRealtimeModalities({
			requested: request.outputModalities,
			supported: SUPPORTED_OUTPUT_MODALITIES_BY_TYPE[request.type],
			label: "output",
		});

		const modalities = request.outputModalities ?? DEFAULT_OUTPUT_MODALITIES_BY_TYPE[request.type];
		if (
			request.type === "realtime" &&
			modalities.includes("audio") &&
			modalities.includes("text")
		) {
			throw new AssistantError(
				"OpenAI realtime sessions support audio or text output, not both",
				ErrorType.PARAMS_ERROR,
			);
		}

		return modalities;
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
		const outputModalities = this.getOutputModalities(request);
		const audioOutput = outputModalities.includes("audio")
			? {
					output: {
						format: this.buildAudioFormat(),
						voice: request.voice ?? DEFAULT_VOICE,
					},
				}
			: {};

		return {
			session: {
				type: "realtime",
				model,
				output_modalities: outputModalities,
				...(request.instructions ? { instructions: request.instructions } : {}),
				audio: {
					input: {
						format: this.buildAudioFormat(),
						turn_detection: TRANSCRIPTION_TURN_DETECTION,
					},
					...audioOutput,
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
			provider: this.name,
			transport: DEFAULT_TRANSPORT,
			url: OPENAI_WEBRTC_CALL_URL,
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

		const transport = this.getTransport(request);
		const inputModalities = this.getInputModalities(request);
		const outputModalities = this.getOutputModalities(request);
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
				"OpenAI-Safety-Identifier": await this.getSafetyIdentifier(request),
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw await createProviderResponseError(response, "Failed to create realtime session");
		}

		const clientSecret = (await response.json()) as OpenAIRealtimeClientSecretResponse;
		return {
			...(this.normalizeClientSecretResponse(clientSecret) as Record<string, unknown>),
			transport,
			input_modalities: inputModalities,
			output_modalities: outputModalities,
			modalities: outputModalities,
		};
	}
}
