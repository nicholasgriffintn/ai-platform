import { providerLibrary } from "../../library";
import type { ProviderFactoryContext } from "../../registry/types";
import type {
	ResearchProvider,
	ResearchProviderName,
	ResearchOptions,
	ResearchResult,
	ResearchResultError,
	ResearchTaskHandle,
} from "~/types";

export type {
	ResearchProvider,
	ResearchProviderName,
	ResearchOptions,
	ResearchResult,
	ResearchResultError,
	ResearchTaskHandle,
} from "~/types";
export * from "./providers";

/**
 * Resolve a research provider instance from the provider library.
 * @param providerName - Registered provider identifier
 * @param context - Optional provider factory context (env, user, config)
 */
export function getResearchProvider(
	providerName: ResearchProviderName,
	context?: ProviderFactoryContext,
): ResearchProvider {
	return providerLibrary.research(providerName, context);
}

/**
 * List all registered research providers (including aliases).
 */
export function listResearchProviders(): string[] {
	const summaries = providerLibrary.list("research");
	const names = new Set<string>();

	for (const summary of summaries) {
		names.add(summary.name);
		summary.aliases?.forEach((alias) => names.add(alias));
	}

	return Array.from(names).sort();
}
