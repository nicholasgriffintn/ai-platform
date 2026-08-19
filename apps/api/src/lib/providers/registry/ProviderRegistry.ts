import { CategoryRegistry, isRegistryError } from "@ngriffin_uk/polychat-library-registry";

import { AssistantError, ErrorType } from "~/utils/errors";

import type {
  CategoryProviderMap,
  ProviderCategory,
  ProviderFactoryContext,
  ProviderMetadata,
  ProviderRegistration,
  ProviderSummary,
} from "./types";

function toAssistantError(error: unknown, category: ProviderCategory): unknown {
  if (!isRegistryError(error)) {
    return error;
  }

  if (error.code === "duplicate_registration") {
    return new AssistantError(
      `Provider "${error.entryName}" already registered for category "${category}"`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  if (error.code === "unknown_category") {
    return new AssistantError(
      `No providers registered for category "${category}"`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return new AssistantError(
    `Unknown ${category} provider "${error.entryName}"`,
    ErrorType.CONFIGURATION_ERROR,
  );
}

export class ProviderRegistry {
  private readonly registry = new CategoryRegistry<
    CategoryProviderMap,
    ProviderFactoryContext,
    ProviderMetadata
  >();

  register<TCategory extends ProviderCategory>(
    category: TCategory,
    registration: ProviderRegistration<CategoryProviderMap[TCategory]>,
  ): void {
    try {
      this.registry.register(category, registration);
    } catch (error) {
      throw toAssistantError(error, category);
    }
  }

  resolve<TCategory extends ProviderCategory>(
    category: TCategory,
    providerName: string,
    context: ProviderFactoryContext = {},
  ): CategoryProviderMap[TCategory] {
    try {
      return this.registry.resolve(category, providerName, context);
    } catch (error) {
      throw toAssistantError(error, category);
    }
  }

  list(category?: ProviderCategory): ProviderSummary[] {
    return this.registry.listEntries(category).map((entry) => ({
      name: entry.name,
      category: entry.category,
      aliases: entry.aliases,
      metadata: entry.metadata,
    }));
  }
}
