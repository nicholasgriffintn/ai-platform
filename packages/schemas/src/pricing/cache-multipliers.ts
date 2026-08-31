export type CacheMultipliers = {
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

export const DEFAULT_CACHE_MULTIPLIERS: CacheMultipliers = {
  cacheRead: 1.0,
  cacheWrite5m: 1.0,
  cacheWrite1h: 1.0,
};

export const PROVIDER_CACHE_MULTIPLIERS: Record<string, Partial<CacheMultipliers>> = {
  anthropic: { cacheRead: 0.1, cacheWrite5m: 1.25, cacheWrite1h: 2.0 },
  openai: { cacheRead: 0.25 },
  google: { cacheRead: 0.25 },
  deepseek: { cacheRead: 0.1 },
};

export function cacheMultipliersForProvider(provider?: string | null): CacheMultipliers {
  if (!provider) {
    return DEFAULT_CACHE_MULTIPLIERS;
  }

  const key = provider.trim().toLowerCase();
  const overrides =
    PROVIDER_CACHE_MULTIPLIERS[key] ?? PROVIDER_CACHE_MULTIPLIERS[key.split("-")[0] ?? ""];

  if (!overrides) {
    return DEFAULT_CACHE_MULTIPLIERS;
  }

  return { ...DEFAULT_CACHE_MULTIPLIERS, ...overrides };
}
