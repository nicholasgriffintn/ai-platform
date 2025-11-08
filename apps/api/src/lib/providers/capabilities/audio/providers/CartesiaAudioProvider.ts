import type {
	AudioProvider,
	AudioSynthesisRequest,
	AudioSynthesisResult,
} from "..";
import { BaseAudioProvider } from "../base";
import { CertesiaProvider } from "~/lib/providers/capabilities/chat/providers/certesia";
import { AssistantError, ErrorType } from "~/utils/errors";

export class CartesiaAudioProvider
	extends BaseAudioProvider
	implements AudioProvider
{
	name = "cartesia";
	private readonly provider = new CertesiaProvider();

	async synthesize(
		request: AudioSynthesisRequest,
	): Promise<AudioSynthesisResult> {
		const storage = this.requireStorage(request);
		const slugBase = this.resolveSlugBase(request);
		const objectKey = this.buildObjectKey(slugBase);

		const response = await this.provider.getResponse({
			model: request.voice ?? "sonic",
			message: request.input,
			env: request.env,
			messages: [],
			user: request.user,
		});

		if (!(response instanceof Response) && !(response instanceof ArrayBuffer)) {
			throw new AssistantError(
				"Cartesia returned an unexpected payload",
				ErrorType.PROVIDER_ERROR,
			);
		}

		let audioBuffer: ArrayBuffer;
		if (response instanceof Response) {
			audioBuffer = await response.arrayBuffer();
		} else {
			audioBuffer = response;
		}

		if (!audioBuffer || audioBuffer.byteLength === 0) {
			throw new AssistantError(
				"No audio data returned by Cartesia",
				ErrorType.PROVIDER_ERROR,
			);
		}

		await storage.uploadObject(objectKey, new Uint8Array(audioBuffer));

		return {
			key: objectKey,
			url: this.buildPublicUrl(objectKey, request.env.PUBLIC_ASSETS_URL),
			metadata: {
				voice: request.voice,
				engine: "cartesia",
			},
		};
	}
}
