import type { RegistryLifecycle } from "@ngriffin_uk/polychat-library-registry";

export type ProviderInstanceMap = Record<string, unknown>;

export type ProviderCategoryOf<TMap extends ProviderInstanceMap> = keyof TMap & string;

export type ProviderLifecycle = RegistryLifecycle;

export interface ProviderMetadata {
  vendor?: string;
  description?: string;
  website?: string;
  models?: string[];
  defaultModel?: string;
  categories?: string[];
  tags?: string[];
}

export interface ProviderRegistration<TInstance, TContext> {
  name: string;
  aliases?: string[];
  lifecycle?: ProviderLifecycle;
  metadata?: ProviderMetadata;
  create: (context: TContext) => TInstance;
}

export interface ProviderSummary<TCategory extends string = string> {
  name: string;
  category: TCategory;
  aliases?: string[];
  metadata?: ProviderMetadata;
}
