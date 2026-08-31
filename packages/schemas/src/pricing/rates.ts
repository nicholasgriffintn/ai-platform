import { DIRECT_COST_UNIT, type UsageUnit } from "./units";

export const RATE_WILDCARD_RESOURCE = "*";

export type RateEntry = {
  vendor: string;
  resource: string;
  unit: UsageUnit;
  perUnitMicros: number;
  effectiveFrom: string;
  tier?: string;
};

export type RateQuery = {
  vendor: string;
  resource: string;
  unit: UsageUnit;
  occurredAt: string;
  tier?: string;
};

export type PricedUsage = {
  costMicros: number;
  unitCostMicros: number | null;
  rateVersion: string | null;
  estimated: boolean;
};

export type PriceUsageOptions = {
  onMissingRate?: (query: RateQuery) => void;
};

function normaliseKey(value: string): string {
  return value.trim().toLowerCase();
}

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function matchesTier(entry: RateEntry, queryTier?: string): boolean {
  if (!entry.tier) {
    return true;
  }

  return queryTier !== undefined && normaliseKey(entry.tier) === normaliseKey(queryTier);
}

function specificity(entry: RateEntry): number {
  const resourceScore = entry.resource === RATE_WILDCARD_RESOURCE ? 0 : 2;
  const tierScore = entry.tier ? 1 : 0;

  return resourceScore + tierScore;
}

export function resolveRateEntry(
  entries: readonly RateEntry[],
  query: RateQuery,
): RateEntry | null {
  const vendor = normaliseKey(query.vendor);
  const resource = normaliseKey(query.resource);
  const occurredAt = toTimestamp(query.occurredAt);

  if (Number.isNaN(occurredAt)) {
    return null;
  }

  let best: RateEntry | null = null;
  let bestSpecificity = -1;
  let bestEffectiveFrom = Number.NEGATIVE_INFINITY;

  for (const entry of entries) {
    if (entry.unit !== query.unit || normaliseKey(entry.vendor) !== vendor) {
      continue;
    }

    const entryResource = normaliseKey(entry.resource);

    if (entryResource !== RATE_WILDCARD_RESOURCE && entryResource !== resource) {
      continue;
    }

    if (!matchesTier(entry, query.tier)) {
      continue;
    }

    const effectiveFrom = toTimestamp(entry.effectiveFrom);

    if (Number.isNaN(effectiveFrom) || effectiveFrom > occurredAt) {
      continue;
    }

    const entrySpecificity = specificity(entry);

    if (
      entrySpecificity > bestSpecificity ||
      (entrySpecificity === bestSpecificity && effectiveFrom > bestEffectiveFrom)
    ) {
      best = entry;
      bestSpecificity = entrySpecificity;
      bestEffectiveFrom = effectiveFrom;
    }
  }

  return best;
}

export function priceUsage(
  entries: readonly RateEntry[],
  query: RateQuery,
  quantity: number,
  options: PriceUsageOptions = {},
): PricedUsage {
  const safeQuantity = Number.isFinite(quantity) ? quantity : 0;

  if (query.unit === DIRECT_COST_UNIT) {
    return {
      costMicros: Math.round(safeQuantity),
      unitCostMicros: 1,
      rateVersion: null,
      estimated: false,
    };
  }

  const entry = resolveRateEntry(entries, query);

  if (!entry) {
    options.onMissingRate?.(query);

    return { costMicros: 0, unitCostMicros: null, rateVersion: null, estimated: true };
  }

  return {
    costMicros: Math.round(safeQuantity * entry.perUnitMicros),
    unitCostMicros: entry.perUnitMicros,
    rateVersion: entry.effectiveFrom,
    estimated: false,
  };
}
