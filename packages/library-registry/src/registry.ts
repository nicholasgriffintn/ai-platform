import { RegistryError } from "./errors";

export type RegistryLifecycle = "singleton" | "transient";

export interface RegistryRegistration<
  TInstance,
  TContext = void,
  TMetadata = Record<string, unknown>,
> {
  name: string;
  aliases?: string[];
  lifecycle?: RegistryLifecycle;
  metadata?: TMetadata;
  create: (context: TContext) => TInstance;
}

export interface RegistryEntry<
  TInstance,
  TMetadata = Record<string, unknown>,
  TCategory extends string = string,
> {
  name: string;
  category: TCategory;
  aliases?: string[];
  metadata?: TMetadata;
  instance?: TInstance;
}

interface InternalRegistration<TContext, TMetadata> {
  id: string;
  name: string;
  aliases?: string[];
  lifecycle: RegistryLifecycle;
  metadata?: TMetadata;
  create: (context: TContext) => unknown;
  instance?: unknown;
}

type CategoryKey<TInstanceMap> = keyof TInstanceMap & string;

export class CategoryRegistry<
  TInstanceMap extends Record<string, unknown> = Record<string, unknown>,
  TContext = void,
  TMetadata = Record<string, unknown>,
> {
  private readonly categories = new Map<
    CategoryKey<TInstanceMap>,
    Map<string, InternalRegistration<TContext, TMetadata>>
  >();

  register<TCategory extends CategoryKey<TInstanceMap>>(
    category: TCategory,
    registration: RegistryRegistration<TInstanceMap[TCategory], TContext, TMetadata>,
  ): void {
    const key = registration.name.toLowerCase();
    const store = this.getOrCreateCategoryStore(category);

    if (store.has(key)) {
      throw new RegistryError("duplicate_registration", category, registration.name);
    }

    const internalRegistration: InternalRegistration<TContext, TMetadata> = {
      id: key,
      name: registration.name,
      aliases: registration.aliases,
      lifecycle: registration.lifecycle ?? "singleton",
      metadata: registration.metadata,
      create: registration.create,
    };

    store.set(key, internalRegistration);

    registration.aliases?.forEach((alias) => {
      store.set(alias.toLowerCase(), internalRegistration);
    });
  }

  resolve<TCategory extends CategoryKey<TInstanceMap>>(
    category: TCategory,
    name: string,
    context: TContext,
  ): TInstanceMap[TCategory] {
    const store = this.categories.get(category);

    if (!store) {
      throw new RegistryError("unknown_category", category);
    }

    const registration = store.get(name.toLowerCase());

    if (!registration) {
      throw new RegistryError("unknown_entry", category, name);
    }

    if (registration.lifecycle === "singleton") {
      if (registration.instance === undefined) {
        registration.instance = registration.create(context);
      }

      return registration.instance as TInstanceMap[TCategory];
    }

    return registration.create(context) as TInstanceMap[TCategory];
  }

  has(category: CategoryKey<TInstanceMap>, name: string): boolean {
    return Boolean(this.categories.get(category)?.has(name.toLowerCase()));
  }

  hasCategory(category: CategoryKey<TInstanceMap>): boolean {
    return this.categories.has(category);
  }

  categoryKeys(): CategoryKey<TInstanceMap>[] {
    return [...this.categories.keys()];
  }

  listEntries<TCategory extends CategoryKey<TInstanceMap>>(
    category?: TCategory,
  ): RegistryEntry<TInstanceMap[TCategory], TMetadata, TCategory>[] {
    if (category) {
      return this.listCategoryEntries(category);
    }

    const entries: RegistryEntry<TInstanceMap[TCategory], TMetadata, TCategory>[] = [];

    for (const categoryKey of this.categories.keys()) {
      entries.push(...this.listCategoryEntries(categoryKey as TCategory));
    }

    return entries;
  }

  private listCategoryEntries<TCategory extends CategoryKey<TInstanceMap>>(
    category: TCategory,
  ): RegistryEntry<TInstanceMap[TCategory], TMetadata, TCategory>[] {
    const store = this.categories.get(category);

    if (!store) {
      return [];
    }

    const seen = new Set<string>();
    const entries: RegistryEntry<TInstanceMap[TCategory], TMetadata, TCategory>[] = [];

    for (const registration of store.values()) {
      if (seen.has(registration.id)) {
        continue;
      }

      seen.add(registration.id);
      entries.push({
        name: registration.name,
        category,
        aliases: registration.aliases,
        metadata: registration.metadata,
        instance: registration.instance as TInstanceMap[TCategory] | undefined,
      });
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));

    return entries;
  }

  private getOrCreateCategoryStore(
    category: CategoryKey<TInstanceMap>,
  ): Map<string, InternalRegistration<TContext, TMetadata>> {
    const existing = this.categories.get(category);

    if (existing) {
      return existing;
    }

    const store = new Map<string, InternalRegistration<TContext, TMetadata>>();

    this.categories.set(category, store);

    return store;
  }
}
