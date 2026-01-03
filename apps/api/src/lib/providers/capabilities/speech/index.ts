import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface SpeechGenerationRequest {
	prompt: string;
	env: IEnv;
	user: IUser;
	completion_id?: string;
	app_url?: string;
	slug?: string;
	storage?: StorageService;
	voice?: string;
	locale?: string;
	model?: string;
	metadata?: Record<string, unknown>;
}

export interface SpeechGenerationResult {
	key?: string;
	url?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface SpeechProvider {
	name: string;
	models?: string[];
	generate(request: SpeechGenerationRequest): Promise<SpeechGenerationResult>;
}

/**
 * Resolve a speech provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getSpeechProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): SpeechProvider {
	return providerLibrary.speech(providerName, context);
}

/**
 * List all registered speech providers (includes aliases)
 */
export function listSpeechProviders(): string[] {
	const summaries = providerLibrary.list("speech");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
