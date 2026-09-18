import { CategoryRegistry, isRegistryError } from "@ngriffin_uk/polychat-library-registry";

import { ProviderError } from "./errors";
import type {
  ProviderCategoryOf,
  ProviderInstanceMap,
  ProviderMetadata,
  ProviderRegistration,
  ProviderSummary,
} from "./types";

function toProviderError(error: unknown, category: string): unknown {
  if (!isRegistryError(error)) {
    return error;
  }

  const details = { category, providerName: error.entryName, cause: error };

  switch (error.code) {
    case "duplicate_registration":
      return new ProviderError(
        "duplicate_registration",
        `Provider "${error.entryName}" already registered for category "${category}"`,
        details,
      );
    case "unknown_category":
      return new ProviderError(
        "unknown_category",
        `No providers registered for category "${category}"`,
        details,
      );
    default:
      return new ProviderError(
        "unknown_provider",
        `Unknown ${category} provider "${error.entryName}"`,
        details,
      );
  }
}

export class ProviderRegistry<TMap extends ProviderInstanceMap, TContext> {
  private readonly registry = new CategoryRegistry<TMap, TContext, ProviderMetadata>();

  register<TCategory extends ProviderCategoryOf<TMap>>(
    category: TCategory,
    registration: ProviderRegistration<TMap[TCategory], TContext>,
  ): void {
    try {
      this.registry.register(category, registration);
    } catch (error) {
      throw toProviderError(error, category);
    }
  }

  resolve<TCategory extends ProviderCategoryOf<TMap>>(
    category: TCategory,
    providerName: string,
    context: TContext,
  ): TMap[TCategory] {
    try {
      return this.registry.resolve(category, providerName, context);
    } catch (error) {
      throw toProviderError(error, category);
    }
  }

  has(category: ProviderCategoryOf<TMap>, providerName: string): boolean {
    return this.registry.has(category, providerName);
  }

  list<TCategory extends ProviderCategoryOf<TMap>>(
    category?: TCategory,
  ): ProviderSummary<TCategory>[] {
    return this.registry.listEntries(category).map((entry) => ({
      name: entry.name,
      category: entry.category,
      aliases: entry.aliases,
      metadata: entry.metadata,
    }));
  }
}
