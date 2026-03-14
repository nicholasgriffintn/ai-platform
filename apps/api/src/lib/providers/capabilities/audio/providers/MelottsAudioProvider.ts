import type {
	AudioProvider,
	AudioSynthesisRequest,
	AudioSynthesisResult,
} from "..";
import { BaseAudioProvider } from "../base";
import { WorkersProvider } from "../../chat/providers/workers";

export class MelottsAudioProvider
	extends BaseAudioProvider
	implements AudioProvider
{
	name = "melotts";
	private readonly workersProvider = new WorkersProvider();

	async synthesize(
		request: AudioSynthesisRequest,
	): Promise<AudioSynthesisResult> {
		const response = await this.workersProvider.getResponse({
			model: "@cf/myshell-ai/melotts",
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: request.input,
						},
					],
				},
			],
			lang: request.locale ?? "en",
			env: request.env,
			user: request.user,
		});

		if (typeof response === "string") {
			return {
				response,
				metadata: request.metadata,
			};
		}

		if (response && typeof response === "object") {
			const maybeUrl =
				"url" in response && typeof response.url === "string"
					? response.url
					: undefined;
			const maybeResponse =
				"response" in response && typeof response.response === "string"
					? response.response
					: undefined;

			return {
				response: maybeResponse,
				url: maybeUrl,
				metadata: {
					...request.metadata,
					raw: response,
				},
			};
		}

		return {
			metadata: {
				...request.metadata,
				raw: response,
			},
		};
	}
}
