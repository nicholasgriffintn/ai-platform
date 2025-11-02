import { AIProviderFactory } from "~/lib/providers/factory";
import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/audio/elevenlabs" });

export class ElevenLabsService {
	constructor(
		private readonly env: IEnv,
		private readonly user: IUser,
	) {}

	/**
	 * Synthesize speech using ElevenLabs
	 */
	async synthesizeSpeech(
		content: string,
		storageService: StorageService,
		slug: string,
		modelId = "eleven_multilingual_v2",
	): Promise<string> {
		try {
			const provider = AIProviderFactory.getProvider("elevenlabs");

			const response = await provider.getResponse({
				model: modelId,
				message: content,
				env: this.env,
				messages: [],
				user: this.user,
			});

			const audioData = await response.arrayBuffer();
			if (!audioData || audioData.byteLength === 0) {
				throw new AssistantError(
					"No audio data in ElevenLabs response",
					ErrorType.PROVIDER_ERROR,
				);
			}

			const audioKey = `audio/${slug}.mp3`;

			const bytes = new Uint8Array(audioData);
			await storageService.uploadObject(audioKey, bytes);

			return audioKey;
		} catch (error) {
			logger.error("Error generating audio with ElevenLabs:", { error });
			throw error;
		}
	}
}
