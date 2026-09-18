import { isProviderError, type ProviderError } from "./errors";
import { ProviderRegistry } from "./registry";
import type {
  ProviderCategoryOf,
  ProviderInstanceMap,
  ProviderRegistration,
  ProviderSummary,
} from "./types";

export type ProviderBootstrapper<TMap extends ProviderInstanceMap, TContext> = (
  registry: ProviderRegistry<TMap, TContext>,
) => void;

export type ProviderBootstrappers<TMap extends ProviderInstanceMap, TContext> = Partial<
  Record<ProviderCategoryOf<TMap>, ProviderBootstrapper<TMap, TContext>[]>
>;

export type ProviderDecorator<TMap extends ProviderInstanceMap, TContext> = <
  TCategory extends ProviderCategoryOf<TMap>,
>(
  category: TCategory,
  providerName: string,
  instance: TMap[TCategory],
  context: TContext,
) => TMap[TCategory];

export type ProviderErrorMapper = (error: ProviderError) => unknown;

export type ProviderCategoryDecorators<TMap extends ProviderInstanceMap, TContext> = {
  [TCategory in ProviderCategoryOf<TMap>]?: (
    providerName: string,
    instance: TMap[TCategory],
    context: TContext,
  ) => TMap[TCategory];
};

export interface ProviderLibraryOptions<TMap extends ProviderInstanceMap, TContext> {
  bootstrappers?: ProviderBootstrappers<TMap, TContext>;
  decorate?: ProviderDecorator<TMap, TContext>;
  decorators?: ProviderCategoryDecorators<TMap, TContext>;
  mapError?: ProviderErrorMapper;
  registry?: ProviderRegistry<TMap, TContext>;
}

export class ProviderLibrary<TMap extends ProviderInstanceMap, TContext = void> {
  private readonly registry: ProviderRegistry<TMap, TContext>;
  private readonly decorate?: ProviderDecorator<TMap, TContext>;
  private readonly decorators: ProviderCategoryDecorators<TMap, TContext>;
  private readonly mapError?: ProviderErrorMapper;
  private readonly bootstrappers = new Map<
    ProviderCategoryOf<TMap>,
    ProviderBootstrapper<TMap, TContext>[]
  >();
  private readonly ranBootstrappers = new WeakSet<ProviderBootstrapper<TMap, TContext>>();

  constructor(options: ProviderLibraryOptions<TMap, TContext> = {}) {
    this.registry = options.registry ?? new ProviderRegistry<TMap, TContext>();
    this.decorate = options.decorate;
    this.decorators = options.decorators ?? {};
    this.mapError = options.mapError;

    const bootstrappers: ProviderBootstrappers<TMap, TContext> = options.bootstrappers ?? {};

    for (const category of Object.keys(bootstrappers) as ProviderCategoryOf<TMap>[]) {
      this.bootstrappers.set(category, [...(bootstrappers[category] ?? [])]);
    }
  }

  registerBootstrapper(
    category: ProviderCategoryOf<TMap>,
    bootstrapper: ProviderBootstrapper<TMap, TContext>,
  ): void {
    const existing = this.bootstrappers.get(category) ?? [];

    existing.push(bootstrapper);
    this.bootstrappers.set(category, existing);
  }

  register<TCategory extends ProviderCategoryOf<TMap>>(
    category: TCategory,
    registration: ProviderRegistration<TMap[TCategory], TContext>,
  ): void {
    this.guard(() => this.registry.register(category, registration));
  }

  resolve<TCategory extends ProviderCategoryOf<TMap>>(
    category: TCategory,
    providerName: string,
    context: TContext,
  ): TMap[TCategory] {
    const resolved = this.guard(() => {
      this.ensureBootstrapped(category);

      return this.registry.resolve(category, providerName, context);
    });
    const categoryDecorator = this.decorators[category];
    const instance = categoryDecorator
      ? categoryDecorator(providerName, resolved, context)
      : resolved;

    return this.decorate ? this.decorate(category, providerName, instance, context) : instance;
  }

  has(category: ProviderCategoryOf<TMap>, providerName: string): boolean {
    this.guard(() => this.ensureBootstrapped(category));

    return this.registry.has(category, providerName);
  }

  list<TCategory extends ProviderCategoryOf<TMap>>(
    category?: TCategory,
  ): ProviderSummary<TCategory>[] {
    this.guard(() => {
      for (const known of category ? [category] : this.bootstrappers.keys()) {
        this.ensureBootstrapped(known);
      }
    });

    return this.registry.list(category);
  }

  listNames(
    category: ProviderCategoryOf<TMap>,
    options: { includeAliases?: boolean } = {},
  ): string[] {
    const names = new Set<string>();

    for (const summary of this.list(category)) {
      names.add(summary.name);

      if (options.includeAliases) {
        summary.aliases?.forEach((alias) => names.add(alias));
      }
    }

    return Array.from(names).sort();
  }

  private guard<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      throw this.mapError && isProviderError(error) ? this.mapError(error) : error;
    }
  }

  private ensureBootstrapped(category: ProviderCategoryOf<TMap>): void {
    for (const bootstrapper of this.bootstrappers.get(category) ?? []) {
      if (this.ranBootstrappers.has(bootstrapper)) {
        continue;
      }

      this.ranBootstrappers.add(bootstrapper);
      bootstrapper(this.registry);
    }
  }
}
