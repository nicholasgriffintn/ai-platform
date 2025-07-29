import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface TranscriptionRequest {
  env: IEnv;
  audio: Blob | string;
  user: IUser;
  provider?: string;
  timestamps?: boolean;
}

export interface TranscriptionResponse {
  text: string;
  data?: any;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResponse>;
}

export abstract class BaseTranscriptionProvider
  implements TranscriptionProvider
{
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
  protected getApiKey(env: IEnv): string {
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

  /**
   * Main transcription method
   */
  abstract transcribe(
    request: TranscriptionRequest,
  ): Promise<TranscriptionResponse>;
}
