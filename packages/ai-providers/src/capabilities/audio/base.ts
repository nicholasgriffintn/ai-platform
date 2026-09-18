import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";

import type { ProviderStorage } from "../../host.js";
import type { ProviderRuntime } from "../../runtime.js";
import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from "./index.js";

export abstract class BaseAudioProvider implements AudioProvider {
  abstract name: string;

  constructor(protected readonly runtime: ProviderRuntime) {}

  protected requireStorage(request: AudioSynthesisRequest): ProviderStorage {
    if (!request.storage) {
      throw new AssistantError(
        `${this.name} audio provider requires a storage service`,
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    return request.storage;
  }

  protected resolveSlugBase(request: AudioSynthesisRequest): string {
    return (
      request.slug ??
      `tts/${(request.user?.email || request.user?.id || "anonymous")
        .toString()
        .replace(/[^a-zA-Z0-9]/g, "-")}-${generateId()}`
    );
  }

  protected buildObjectKey(slugBase: string, extension = "mp3", prefix = "audio"): string {
    const sanitizedBase = slugBase.replace(/^\//, "");
    const sanitizedPrefix = prefix.replace(/\/$/, "");
    const hasExtension = sanitizedBase.endsWith(`.${extension}`);
    const key = `${sanitizedPrefix}/${sanitizedBase}${hasExtension ? "" : `.${extension}`}`;

    return key.replace(/\/{2,}/g, "/");
  }

  protected buildAudioDataUrl(buffer: ArrayBuffer, mimeType = "audio/mpeg"): string {
    return `data:${mimeType};base64,${bufferToBase64(buffer)}`;
  }

  abstract synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult>;
}
