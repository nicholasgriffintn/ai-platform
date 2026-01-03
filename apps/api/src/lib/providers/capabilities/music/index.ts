import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface MusicGenerationRequest {
	prompt: string;
	env: IEnv;
	user: IUser;
	completion_id?: string;
	app_url?: string;
	slug?: string;
	storage?: StorageService;
	inputAudio?: string;
	duration?: number;
	model?: string;
	metadata?: Record<string, unknown>;
}

export interface MusicGenerationResult {
	key?: string;
	url?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface MusicProvider {
	name: string;
	models?: string[];
	generate(request: MusicGenerationRequest): Promise<MusicGenerationResult>;
}

/**
 * Resolve a music provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getMusicProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): MusicProvider {
	return providerLibrary.music(providerName, context);
}

/**
 * List all registered music providers (includes aliases)
 */
export function listMusicProviders(): string[] {
	const summaries = providerLibrary.list("music");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
