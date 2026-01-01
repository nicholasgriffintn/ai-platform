import { AssistantError, ErrorType } from "~/utils/errors";
import type {
	TranscriptionProvider,
	TranscriptionRequest,
	TranscriptionResult,
} from "./index";

export abstract class BaseTranscriptionProvider implements TranscriptionProvider {
	abstract name: string;

	/**
	 * Gets the environment variable name for the provider's API key
	 */
	protected getProviderKeyName?(): string {
		return undefined;
	}

	/**
	 * Gets the API key for the provider from environment
	 */
	protected getApiKey(env: Record<string, any>): string {
		if (!this.getProviderKeyName) {
			return "";
		}

		const envKey = env[this.getProviderKeyName()];
		if (!envKey) {
			throw new AssistantError(
				`Missing ${this.getProviderKeyName()}`,
				ErrorType.CONFIGURATION_ERROR,
			);
		}

		return envKey;
	}

	/**
	 * Validates the transcription request
	 */
	protected validateRequest(request: TranscriptionRequest): void {
		if (!request.audio) {
			throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
		}

		if (!request.user) {
			throw new AssistantError("Missing user", ErrorType.PARAMS_ERROR);
		}
	}

	abstract transcribe(
		request: TranscriptionRequest,
	): Promise<TranscriptionResult>;
}
