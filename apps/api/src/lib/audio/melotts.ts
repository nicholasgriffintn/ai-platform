import { AIProviderFactory } from "~/lib/providers/factory";
import type { IEnv, IUser } from "~/types";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/audio/melotts" });

export class MelottsService {
	private readonly provider = AIProviderFactory.getProvider("workers-ai");

	constructor(
		private readonly env: IEnv,
		private readonly user: IUser,
	) {
		this.provider = AIProviderFactory.getProvider("workers-ai");
	}

	/**
	 * Synthesize speech using Melotts
	 */
	async synthesizeSpeech(content: string, lang = "en") {
		try {
			const response = await this.provider.getResponse({
				model: "@cf/myshell-ai/melotts",
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: content,
							},
						],
					},
				],
				lang,
				env: this.env,
				user: this.user,
			});

			return response;
		} catch (error) {
			logger.error("Error generating audio with Melotts:", { error });
			throw error;
		}
	}
}
