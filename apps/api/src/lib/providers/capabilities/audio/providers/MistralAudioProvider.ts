import { fetchAIResponse } from "~/lib/providers/lib/fetch";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { base64ToBuffer } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "..";
import {
	getAudioFormatMetadata,
	resolveAudioResponseFormat,
	type AudioResponseFormat,
} from "../formats";
import { BaseAudioProvider } from "../base";

const logger = getLogger({ prefix: "lib/audio/mistral" });

const MISTRAL_TTS_MODEL = "voxtral-mini-tts-2603";
const DEFAULT_VOICE_ID = "82c99ee6-f932-423f-a4a3-d403c8914b8d";

type MistralSpeechResponse = {
	audio_data?: unknown;
	eventId?: string;
	log_id?: string;
	cacheStatus?: string;
};

export class MistralAudioProvider extends BaseAudioProvider implements AudioProvider {
	name = "mistral";

	async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
		if (!request.env.AI_GATEWAY_TOKEN) {
			throw new AssistantError("Missing AI_GATEWAY_TOKEN", ErrorType.CONFIGURATION_ERROR);
		}

		const apiKey = await resolveProviderApiKey({
			env: request.env,
			providerName: this.name,
			envKeyName: "MISTRAL_API_KEY",
			userId: request.user?.id,
			logger,
		});
		const responseFormat = resolveAudioResponseFormat(request.responseFormat);
		const { extension, mimeType } = getAudioFormatMetadata(responseFormat);
		const response = await this.createSpeech(request, apiKey, responseFormat);

		if (typeof response.audio_data !== "string" || response.audio_data.length === 0) {
			throw new AssistantError("No audio data returned by Mistral", ErrorType.PROVIDER_ERROR);
		}

		if (request.store === false) {
			return {
				audioBase64: response.audio_data,
				audioDataUrl: `data:${mimeType};base64,${response.audio_data}`,
				audioMimeType: mimeType,
				metadata: this.buildMetadata(request, responseFormat, response),
			};
		}

		const slugBase = this.resolveSlugBase(request);
		const objectKey = this.buildObjectKey(slugBase, extension);
		const storage = this.requireStorage(request);
		const audioData = base64ToBuffer(response.audio_data);

		if (audioData.byteLength === 0) {
			throw new AssistantError("No audio data returned by Mistral", ErrorType.PROVIDER_ERROR);
		}

		await storage.uploadObject(objectKey, audioData);

		return {
			key: objectKey,
			url: this.buildPublicUrl(objectKey, request.env.PUBLIC_ASSETS_URL),
			audioMimeType: mimeType,
			metadata: this.buildMetadata(request, responseFormat, response),
		};
	}

	private async createSpeech(
		request: AudioSynthesisRequest,
		apiKey: string,
		responseFormat: AudioResponseFormat,
	): Promise<MistralSpeechResponse> {
		const voiceInput = request.refAudio
			? { ref_audio: request.refAudio }
			: { voice_id: request.voice ?? DEFAULT_VOICE_ID };

		return fetchAIResponse<MistralSpeechResponse>(
			false,
			this.name,
			"v1/audio/speech",
			{
				"cf-aig-authorization": request.env.AI_GATEWAY_TOKEN || "",
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			{
				model: MISTRAL_TTS_MODEL,
				input: request.input,
				response_format: responseFormat,
				...voiceInput,
			},
			request.env,
		);
	}

	private buildMetadata(
		request: AudioSynthesisRequest,
		responseFormat: AudioResponseFormat,
		response: MistralSpeechResponse,
	): Record<string, unknown> {
		return {
			...request.metadata,
			engine: "mistral",
			model: MISTRAL_TTS_MODEL,
			voice: request.refAudio ? undefined : (request.voice ?? DEFAULT_VOICE_ID),
			responseFormat,
			eventId: response.eventId,
			logId: response.log_id,
			cacheStatus: response.cacheStatus,
		};
	}
}
