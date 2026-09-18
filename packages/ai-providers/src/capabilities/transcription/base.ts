import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ProviderRuntime } from "../../runtime.js";
import type { TranscriptionProvider, TranscriptionRequest, TranscriptionResult } from "./index.js";

export abstract class BaseTranscriptionProvider implements TranscriptionProvider {
  abstract name: string;

  constructor(protected readonly runtime: ProviderRuntime) {}

  protected getProviderKeyName(): string | undefined {
    return undefined;
  }

  protected getApiKey(env: Record<string, any>): string {
    const keyName = this.getProviderKeyName();

    if (!keyName) {
      return "";
    }

    const envKey = env[keyName];

    if (!envKey) {
      throw new AssistantError(`Missing ${keyName}`, ErrorType.CONFIGURATION_ERROR);
    }

    return envKey;
  }

  protected validateRequest(request: TranscriptionRequest): void {
    if (!request.audio?.file) {
      throw new AssistantError("Missing audio", ErrorType.PARAMS_ERROR);
    }

    if (!request.user) {
      throw new AssistantError("Missing user", ErrorType.PARAMS_ERROR);
    }
  }

  abstract transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}
