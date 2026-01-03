import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface VideoGenerationRequest {
	prompt: string;
	env: IEnv;
	user: IUser;
	completion_id?: string;
	app_url?: string;
	slug?: string;
	storage?: StorageService;
	negativePrompt?: string;
	aspectRatio?: string;
	width?: number;
	height?: number;
	duration?: number;
	videoLength?: number;
	guidanceScale?: number;
	model?: string;
	metadata?: Record<string, unknown>;
}

export interface VideoGenerationResult {
	key?: string;
	url?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface VideoProvider {
	name: string;
	models?: string[];
	generate(request: VideoGenerationRequest): Promise<VideoGenerationResult>;
}

/**
 * Resolve a video provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getVideoProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): VideoProvider {
	return providerLibrary.video(providerName, context);
}

/**
 * List all registered video providers (includes aliases)
 */
export function listVideoProviders(): string[] {
	const summaries = providerLibrary.list("video");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
