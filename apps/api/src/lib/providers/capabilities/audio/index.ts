import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import type { AudioResponseFormat } from "./formats";

export interface AudioSynthesisRequest {
	input: string;
	env: IEnv;
	user: IUser;
	slug?: string;
	storage?: StorageService;
	store?: boolean;
	voice?: string;
	locale?: string;
	refAudio?: string;
	responseFormat?: AudioResponseFormat;
	metadata?: Record<string, unknown>;
}

export interface AudioSynthesisResult {
	key?: string;
	url?: string;
	audioBase64?: string;
	audioDataUrl?: string;
	audioMimeType?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface AudioProvider {
	name: string;
	synthesize(request: AudioSynthesisRequest): Promise<AudioSynthesisResult>;
}

/**
 * Resolve an audio provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getAudioProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): AudioProvider {
	return providerLibrary.audio(providerName, context);
}

/**
 * List all registered audio providers (includes aliases)
 */
export function listAudioProviders(): string[] {
	const summaries = providerLibrary.list("audio");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
