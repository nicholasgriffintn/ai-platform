import type {
	AudioProvider,
	AudioSynthesisRequest,
	AudioSynthesisResult,
} from "..";
import { BaseAudioProvider } from "../base";
import { PollyProvider } from "../../chat/providers/polly";

export class PollyAudioProvider
	extends BaseAudioProvider
	implements AudioProvider
{
	name = "polly";
	private readonly provider = new PollyProvider();

	async synthesize(
		request: AudioSynthesisRequest,
	): Promise<AudioSynthesisResult> {
		const storage = this.requireStorage(request);
		const slugBase = this.resolveSlugBase(request);

		const key = (await this.provider.getResponse({
			model: request.voice ?? "Ruth",
			message: request.input,
			env: request.env,
			messages: [],
			user: request.user,
			options: {
				slug: slugBase,
				storageService: storage,
			},
		})) as string;

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
