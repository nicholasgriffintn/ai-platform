import { Buffer } from "node:buffer";

import { gatewayId } from "~/constants/app";
import { getAuxiliarySpeechModel } from "~/lib/models";
import { AssistantError, ErrorType } from "~/utils/errors";
import type { TranscriptionRequest, TranscriptionResponse } from "./base";
import { BaseTranscriptionProvider } from "./base";
import { RepositoryManager } from "~/repositories";

async function getAudioForProvider(model: string, res: Response | Blob) {
	// TODO: Only whisper has been configured to work with the body requirements, more to be done in order to configure it.
	if (model === "@cf/deepgram/nova-3") {
		if (res instanceof Blob) {
			throw new AssistantError(
				"Blobs not supported with nova-3",
				ErrorType.PARAMS_ERROR,
			);
		}
		return res.body;
	} else {
		if (model === "@cf/openai/whisper-large-v3-turbo") {
			throw new AssistantError(
				"Not implemented",
				ErrorType.CONFIGURATION_ERROR,
			);
			// const audioData = await res.arrayBuffer();
			// const audioBuffer = Buffer.from(audioData, "binary").toString("base64");
			// return audioBuffer;
		} else {
			const audioData = await res.arrayBuffer();
			return [...new Uint8Array(audioData)];
		}
	}
}

export class WorkersTranscriptionProvider extends BaseTranscriptionProvider {
	name = "workers";

	async transcribe(
		request: TranscriptionRequest,
	): Promise<TranscriptionResponse> {
		this.validateRequest(request);

		const { audio, env, user } = request;

		if (!env.AI) {
			throw new AssistantError("Missing AI binding", ErrorType.PARAMS_ERROR);
		}

		const repositories = new RepositoryManager(env);
		const userSettings = await repositories.userSettings.getUserSettings(
			user?.id,
		);

		const { model: modelToUse, provider: providerToUse } =
			await getAuxiliarySpeechModel(env, userSettings);

		if (!modelToUse || !providerToUse) {
			throw new AssistantError(
				"Missing model or provider",
				ErrorType.PARAMS_ERROR,
			);
		}

		if (providerToUse !== "workers-ai") {
			throw new AssistantError(
				"This provider is only for Workers AI",
				ErrorType.PARAMS_ERROR,
			);
		}

		try {
			let body: Record<string, any> = {};

			if (
				typeof audio === "string" &&
				(audio.startsWith("http://") || audio.startsWith("https://"))
			) {
				const res = await fetch(audio);
				if (!res.ok) {
					throw new AssistantError(
						`Failed to fetch audio from URL: ${res.status} ${res.statusText}`,
						ErrorType.PARAMS_ERROR,
					);
				}

				const contentLength = res.headers.get("content-length");
				if (contentLength) {
					const fileSizeBytes = parseInt(contentLength);
					const MAX_SIZE = 25 * 1024 * 1024; // 25MB limit for Workers AI

					if (fileSizeBytes > MAX_SIZE) {
						throw new AssistantError(
							`File too large for Workers AI (${Math.round(fileSizeBytes / 1024 / 1024)}MB > 25MB). Use a different transcription provider for larger files.`,
							ErrorType.PARAMS_ERROR,
						);
					}
				}

				body.audio = await getAudioForProvider(modelToUse, res);
			} else if (audio instanceof Blob) {
				const MAX_SIZE = 25 * 1024 * 1024; // 25MB limit for Workers AI
				if (audio.size > MAX_SIZE) {
					throw new AssistantError(
						`File too large for Workers AI (${Math.round(audio.size / 1024 / 1024)}MB > 25MB). Use a different transcription provider for larger files.`,
						ErrorType.PARAMS_ERROR,
					);
				}

				body.audio = await getAudioForProvider(modelToUse, audio);
			} else {
				throw new AssistantError(
					"Audio must be a Blob or a URL string",
					ErrorType.PARAMS_ERROR,
				);
			}

			const response = await env.AI.run(
				// @ts-ignore
				modelToUse,
				body,
				{
					gateway: {
						id: gatewayId,
						skipCache: false,
						cacheTtl: 3360,
						metadata: {
							email: user?.email,
						},
					},
				},
			);

			// @ts-ignore - The types are wrong.
			if (!response.text) {
				throw new AssistantError("No response from the model");
			}

			return {
				// @ts-ignore - The types are wrong.
				text: response.text,
				data: response,
			};
		} catch (error) {
			if (error instanceof AssistantError) {
				throw error;
			}

			throw new AssistantError(
				`Workers AI transcription error: ${error instanceof Error ? error.message : "Unknown error"}`,
				ErrorType.EXTERNAL_API_ERROR,
			);
		}
	}
}
