import type {
	AudioProvider,
	AudioSynthesisRequest,
	AudioSynthesisResult,
} from "..";
import { BaseAudioProvider } from "../base";
import { ElevenLabsProvider } from "../../chat/providers/elevenlabs";
import { AssistantError, ErrorType } from "~/utils/errors";

export class ElevenLabsAudioProvider
	extends BaseAudioProvider
	implements AudioProvider
{
	name = "elevenlabs";
	private readonly provider = new ElevenLabsProvider();

	async synthesize(
		request: AudioSynthesisRequest,
	): Promise<AudioSynthesisResult> {
		const storage = this.requireStorage(request);
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
			throw new AssistantError(
				"No audio data returned by ElevenLabs",
				ErrorType.PROVIDER_ERROR,
			);
		}

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
