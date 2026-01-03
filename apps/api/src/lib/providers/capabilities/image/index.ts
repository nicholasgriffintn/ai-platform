import type { StorageService } from "~/lib/storage";
import type { IEnv, IUser } from "~/types";
import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";

export interface ImageGenerationRequest {
	prompt: string;
	env: IEnv;
	user: IUser;
	completion_id?: string;
	app_url?: string;
	slug?: string;
	storage?: StorageService;
	style?: string;
	aspectRatio?: string;
	width?: number;
	height?: number;
	steps?: number;
	model?: string;
	metadata?: Record<string, unknown>;
}

export interface ImageGenerationResult {
	key?: string;
	url?: string;
	response?: string;
	metadata?: Record<string, unknown>;
	raw?: unknown;
}

export interface ImageProvider {
	name: string;
	models?: string[];
	generate(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

/**
 * Resolve an image provider from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getImageProvider(
	providerName: string,
	context?: ProviderFactoryContext,
): ImageProvider {
	return providerLibrary.image(providerName, context);
}

/**
 * List all registered image providers (includes aliases)
 */
export function listImageProviders(): string[] {
	const summaries = providerLibrary.list("image");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
