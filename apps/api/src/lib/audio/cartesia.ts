import { AIProviderFactory } from "~/lib/providers/factory";
import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/audio/cartesia" });

export class CartesiaService {
	constructor(
		private readonly env: IEnv,
		private readonly user: IUser,
	) {}

	/**
	 * Synthesize speech using Cartesia
	 */
	async synthesizeSpeech(
		content: string,
		storageService: StorageService,
		slug: string,
	): Promise<string> {
		try {
			const provider = AIProviderFactory.getProvider("certesia");

			const response = await provider.getResponse({
				model: "sonic",
				message: content,
				env: this.env,
				messages: [],
				user: this.user,
			});

			// TODO: I can't get Cartesia working right now, so this is probably wrong.
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
			logger.error("Error generating audio with Cartesia:", { error });
			throw error;
		}
	}
}
