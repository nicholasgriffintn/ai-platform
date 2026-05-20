import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "..";
import { BaseAudioProvider } from "../base";
import { ElevenLabsProvider } from "../../chat/providers/elevenlabs";
import { AssistantError, ErrorType } from "~/utils/errors";

export class ElevenLabsAudioProvider extends BaseAudioProvider implements AudioProvider {
	name = "elevenlabs";
	private readonly provider = new ElevenLabsProvider();

	async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
		const slugBase = this.resolveSlugBase(request);
		const objectKey = this.buildObjectKey(slugBase);

		const response = await this.provider.getResponse({
			model: request.voice ?? "eleven_multilingual_v2",
			message: request.input,
			env: request.env,
			messages: [],
			user: request.user,
		});

		if (!(response instanceof Response)) {
			throw new AssistantError(
				"ElevenLabs returned an unexpected payload",
				ErrorType.PROVIDER_ERROR,
			);
		}

		const audioData = await response.arrayBuffer();

		if (!audioData || audioData.byteLength === 0) {
			throw new AssistantError("No audio data returned by ElevenLabs", ErrorType.PROVIDER_ERROR);
		}

		if (request.store === false) {
			const audioDataUrl = this.buildAudioDataUrl(audioData);

			return {
				audioBase64: audioDataUrl.replace(/^data:audio\/mpeg;base64,/, ""),
				audioDataUrl,
				audioMimeType: "audio/mpeg",
				metadata: {
					voice: request.voice,
				},
			};
		}

		const storage = this.requireStorage(request);
		await storage.uploadObject(objectKey, new Uint8Array(audioData));

		return {
			key: objectKey,
			url: this.buildPublicUrl(objectKey, request.env.PUBLIC_ASSETS_URL),
			metadata: {
				voice: request.voice,
			},
		};
	}
}
