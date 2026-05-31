import { gatewayId } from "~/constants/app";
import { formatProviderError } from "~/lib/providers/utils/errors";
import { resolveProviderApiKey } from "~/lib/providers/utils/apiKeys";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import type { TranscriptionRequest, TranscriptionResult } from "../index";
import { BaseTranscriptionProvider } from "../base";

const logger = getLogger({ prefix: "lib/transcription/mistral" });

export class MistralTranscriptionProvider extends BaseTranscriptionProvider {
	name = "mistral";

	protected getProviderKeyName(): string {
		return "MISTRAL_API_KEY";
	}

	async transcribe(request: TranscriptionRequest): Promise<TranscriptionResult> {
		this.validateRequest(request);

		const { audio, env, timestamps = false, user } = request;

		if (!env.AI_GATEWAY_TOKEN || !env.ACCOUNT_ID) {
			throw new AssistantError(
				"Missing AI_GATEWAY_TOKEN or ACCOUNT_ID",
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		try {
			const apiKey = await resolveProviderApiKey({
				env,
				providerName: this.name,
				envKeyName: this.getProviderKeyName(),
				userId: user?.id,
				logger,
			});
			const formData = new FormData();

			if (
				typeof audio === "string" &&
				(audio.startsWith("http://") || audio.startsWith("https://"))
			) {
				formData.append("file_url", audio);
			} else {
				if (!(audio instanceof Blob)) {
					throw new AssistantError("Audio must be a Blob or a URL string", ErrorType.PARAMS_ERROR);
				}

				formData.append("file", audio, "audio.wav");
			}

			formData.append("model", "voxtral-mini-2507");
			formData.append("language", "en");

			if (timestamps) {
				formData.append("timestamp_granularities", "segment");
			}

			const gatewayUrl = `https://gateway.ai.cloudflare.com/v1/${env.ACCOUNT_ID}/${gatewayId}/mistral/v1/audio/transcriptions`;

			const response = await fetch(gatewayUrl, {
				method: "POST",
				headers: {
					"cf-aig-authorization": env.AI_GATEWAY_TOKEN,
					Authorization: `Bearer ${apiKey}`,
				},
				body: formData,
			});

			if (!response.ok) {
				throw new AssistantError(
					await formatProviderError(response, "Mistral transcription failed"),
					ErrorType.EXTERNAL_API_ERROR,
					response.status,
				);
			}

			const result = (await response.json()) as { text?: string };

			if (!result.text) {
				throw new AssistantError(
					"No transcription text returned from Mistral",
					ErrorType.EXTERNAL_API_ERROR,
				);
			}

			return {
				text: result.text,
				data: result,
			};
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			throw new AssistantError(
				await formatProviderError(error, "Mistral transcription error"),
				ErrorType.EXTERNAL_API_ERROR,
			);
		}
	}
}
