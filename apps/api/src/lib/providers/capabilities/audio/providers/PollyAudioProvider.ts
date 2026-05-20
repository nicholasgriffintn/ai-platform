import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "..";
import { BaseAudioProvider } from "../base";
import { PollyProvider } from "../../chat/providers/polly";

export class PollyAudioProvider extends BaseAudioProvider implements AudioProvider {
	name = "polly";
	private readonly provider = new PollyProvider();

	async synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult> {
		const slugBase = this.resolveSlugBase(request);
		const storage = request.store === false ? undefined : this.requireStorage(request);

		const response = await this.provider.getResponse({
			model: request.voice ?? "Ruth",
			message: request.input,
			env: request.env,
			messages: [],
			user: request.user,
			options: {
				slug: slugBase,
				storageService: storage,
				returnAudio: request.store === false,
			},
		});

		if (request.store === false && response && typeof response === "object") {
			return {
				audioBase64:
					"audioBase64" in response && typeof response.audioBase64 === "string"
						? response.audioBase64
						: undefined,
				audioDataUrl:
					"audioDataUrl" in response && typeof response.audioDataUrl === "string"
						? response.audioDataUrl
						: undefined,
				audioMimeType:
					"audioMimeType" in response && typeof response.audioMimeType === "string"
						? response.audioMimeType
						: "audio/mpeg",
				metadata: {
					voice: request.voice ?? "Ruth",
					engine: "amazon-polly",
				},
			};
		}

		const key = response as string;

		return {
			key,
			url: this.buildPublicUrl(key, request.env.PUBLIC_ASSETS_URL),
			metadata: {
				voice: request.voice ?? "Ruth",
				engine: "amazon-polly",
			},
		};
	}
}
