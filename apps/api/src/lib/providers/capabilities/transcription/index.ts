import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface TranscriptionRequest {
	env: IEnv;
	audio: Blob | string;
	user: IUser;
	provider?: string;
	timestamps?: boolean;
}

export interface TranscriptionResult {
	text: string;
	data?: unknown;
	metadata?: Record<string, unknown>;
}

export interface TranscriptionProvider {
	name: string;
	transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export { BaseTranscriptionProvider } from "./base";

/**
 * Resolve a transcription provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getTranscriptionProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): TranscriptionProvider {
	return providerLibrary.transcription(providerName, context);
}

/**
 * List registered transcription providers (including aliases).
 */
export function listTranscriptionProviders(): string[] {
	const summaries = providerLibrary.list("transcription");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
