import { getModelConfigByModel } from "~/lib/providers/models";
import { formatGoogleStudioModelResource } from "~/lib/providers/utils/googleStudio";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { RealtimeProvider, RealtimeSessionRequest, RealtimeSessionType } from "../index";
import {
	validateRealtimeModalities,
	type RealtimeModality,
	type RealtimeTransport,
} from "../modalities";

const DEFAULT_REALTIME_MODEL = "gemini-3.1-flash-live-preview";
const SESSION_MODELS_BY_TYPE: Record<RealtimeSessionRequest["type"], string[]> = {
	realtime: [
		DEFAULT_REALTIME_MODEL,
		"gemini-live-2.5-flash",
		"gemini-live-2.5-flash-preview-native-audio",
	],
	translation: [],
	transcription: [],
};
const LIVE_WEBSOCKET_URL =
	"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";
const AUTH_TOKEN_ENDPOINT = "https://generativelanguage.googleapis.com/v1alpha/auth_tokens";
const DEFAULT_VOICE = "Kore";
const DEFAULT_TRANSPORT: RealtimeTransport = "websocket";

const SUPPORTED_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["text", "audio", "image", "video"],
	translation: [],
	transcription: [],
};

const SUPPORTED_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["text", "audio"],
	translation: [],
	transcription: [],
};

const DEFAULT_INPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["audio"],
	translation: [],
	transcription: [],
};

const DEFAULT_OUTPUT_MODALITIES_BY_TYPE: Record<RealtimeSessionType, RealtimeModality[]> = {
	realtime: ["audio"],
	translation: [],
	transcription: [],
};

interface GoogleAuthTokenResponse {
	name: string;
	expireTime?: string;
	newSessionExpireTime?: string;
}

export class GoogleRealtimeProvider implements RealtimeProvider {
	name = "google-ai-studio";
	models = SESSION_MODELS_BY_TYPE.realtime;

	private getProviderKeyName(): string {
		return "GOOGLE_STUDIO_API_KEY";
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
		if (type !== "realtime") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		return DEFAULT_REALTIME_MODEL;
	}

	buildAudioFormat(): Record<string, unknown> {
		return {
			type: "audio/pcm",
			rate: 24000,
		};
	}

	private async resolveModel(request: RealtimeSessionRequest): Promise<string> {
		const requestedModel = request.model || this.getDefaultModel(request.type);
		const supportedModels = SESSION_MODELS_BY_TYPE[request.type];

		if (!supportedModels.includes(requestedModel)) {
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

	private getTransport(request: RealtimeSessionRequest): RealtimeTransport {
		const transport = request.transport ?? DEFAULT_TRANSPORT;
		if (transport !== "websocket") {
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

		return request.outputModalities ?? DEFAULT_OUTPUT_MODALITIES_BY_TYPE[request.type];
	}

	private buildRealtimeInputConfig(
		inputModalities: RealtimeModality[],
	): Record<string, unknown> | undefined {
		if (!inputModalities.includes("video")) {
			return undefined;
		}

		return {
			turnCoverage: "TURN_INCLUDES_AUDIO_ACTIVITY_AND_ALL_VIDEO",
		};
	}

	private buildLiveSetup({
		request,
		model,
		inputModalities,
		outputModalities,
	}: {
		request: RealtimeSessionRequest;
		model: string;
		inputModalities: RealtimeModality[];
		outputModalities: RealtimeModality[];
	}): Record<string, unknown> {
		const responseModalities = outputModalities.map((modality) => modality.toUpperCase());
		const realtimeInputConfig = this.buildRealtimeInputConfig(inputModalities);

		return {
			model: formatGoogleStudioModelResource(model),
			generationConfig: {
				responseModalities,
				...(outputModalities.includes("audio")
					? {
							speechConfig: {
								voiceConfig: {
									prebuiltVoiceConfig: {
										voiceName: request.voice ?? DEFAULT_VOICE,
									},
								},
							},
						}
					: {}),
			},
			...(realtimeInputConfig ? { realtimeInputConfig } : {}),
			...(request.instructions
				? {
						systemInstruction: {
							parts: [{ text: request.instructions }],
						},
					}
				: {}),
		};
	}

	private buildTokenRequestBody(
		request: RealtimeSessionRequest,
		model: string,
		inputModalities: RealtimeModality[],
		outputModalities: RealtimeModality[],
	): Record<string, unknown> {
		const now = Date.now();
		return {
			uses: 1,
			expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
			newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
			bidiGenerateContentSetup: this.buildLiveSetup({
				request,
				model,
				inputModalities,
				outputModalities,
			}),
		};
	}

	private buildWebSocketUrl(token: string): string {
		const url = new URL(LIVE_WEBSOCKET_URL);
		url.searchParams.set("access_token", token);
		return url.toString();
	}

	async createSession(request: RealtimeSessionRequest): Promise<unknown> {
		if (request.type !== "realtime") {
			throw new AssistantError("Invalid session type", ErrorType.PARAMS_ERROR);
		}

		const transport = this.getTransport(request);
		const inputModalities = this.getInputModalities(request);
		const outputModalities = this.getOutputModalities(request);
		const model = await this.resolveModel(request);
		const apiKey = await this.getApiKey(request);
		const setup = this.buildLiveSetup({
			request,
			model,
			inputModalities,
			outputModalities,
		});
		const body = this.buildTokenRequestBody(request, model, inputModalities, outputModalities);

		const response = await fetch(AUTH_TOKEN_ENDPOINT, {
			method: "POST",
			headers: {
				"x-goog-api-key": apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			throw new AssistantError(
				await formatProviderError(response, "Failed to create Gemini Live session"),
				ErrorType.EXTERNAL_API_ERROR,
				response.status,
			);
		}

		const token = (await response.json()) as GoogleAuthTokenResponse;
		if (!token.name) {
			throw new AssistantError("Gemini Live session token missing", ErrorType.PROVIDER_ERROR);
		}

		const audioOutput = outputModalities.includes("audio")
			? {
					output: {
						format: this.buildAudioFormat(),
						voice: request.voice ?? DEFAULT_VOICE,
					},
				}
			: {};

		return {
			id: token.name,
			object: "realtime.session",
			type: "realtime",
			provider: this.name,
			transport,
			protocol: "gemini-live",
			model,
			input_modalities: inputModalities,
			output_modalities: outputModalities,
			modalities: outputModalities,
			audio: {
				input: {
					format: {
						type: "audio/pcm",
						rate: 16000,
					},
				},
				...audioOutput,
			},
			client_secret: {
				value: token.name,
				expires_at: token.expireTime
					? Math.floor(new Date(token.expireTime).getTime() / 1000)
					: undefined,
			},
			url: this.buildWebSocketUrl(token.name),
			setup,
		};
	}
}
