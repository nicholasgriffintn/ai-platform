import type { AudioProvider, AudioSynthesisRequest, AudioSynthesisResult } from ".";
import type { StorageService } from "~/lib/storage";
import { bufferToBase64 } from "~/utils/base64";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

export abstract class BaseAudioProvider implements AudioProvider {
	abstract name: string;

	protected requireStorage(request: AudioSynthesisRequest): StorageService {
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

	protected buildPublicUrl(key: string, envBase?: string): string | undefined {
		if (!envBase) {
			return undefined;
		}

		return `${envBase.replace(/\/$/, "")}/${key}`;
	}

	protected buildAudioDataUrl(buffer: ArrayBuffer, mimeType = "audio/mpeg"): string {
		return `data:${mimeType};base64,${bufferToBase64(buffer)}`;
	}

	abstract synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult>;
}
