import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import type {
	SearchProvider,
	SearchOptions,
	SearchProviderName,
	SearchResult,
} from "~/types";

export type {
	SearchProvider,
	SearchOptions,
	SearchProviderName,
	SearchResult,
} from "~/types";
export * from "./providers";

/**
 * Resolve a search provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getSearchProvider(
	providerName: SearchProviderName,
	context?: ProviderFactoryContext,
): SearchProvider {
	return providerLibrary.search(providerName, context);
}

/**
 * List all registered search providers (including aliases).
 */
export function listSearchProviders(): string[] {
	const summaries = providerLibrary.list("search");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
