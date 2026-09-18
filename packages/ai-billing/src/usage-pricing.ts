import {
  creditMicrosFromCostMicros,
  DEFAULT_MARGIN,
  priceUsage,
  usagePeriodFromDate,
  type RateEntry,
  type RateQuery,
  type UsageEventReason,
  type UsageSource,
  type UsageUnit,
} from "@ngriffin_uk/polychat-schemas";

const BYOK_EXEMPT_SOURCES: ReadonlySet<UsageSource> = new Set<UsageSource>([
  "model",
  "hosted_tool",
]);

export interface UsagePricingInput {
  source: UsageSource;
  vendor: string;
  resource: string;
  unit: UsageUnit;
  quantity: number;
  occurredAt?: string;
  tier?: string;
  byok?: boolean;
  margin?: number;
  rates?: readonly RateEntry[];
  reason?: UsageEventReason | null;
}

export interface PricedUsageDraft {
  occurredAt: string;
  period: string;
  rateVersion: string | null;
  unitCostMicros: number | null;
  costMicros: number;
  creditMicros: number;
  billable: boolean;
  byok: boolean;
  estimated: boolean;
}

export interface PriceUsageDraftOptions {
  onMissingRate?: (query: RateQuery) => void;
  now?: () => Date;
}

export function priceUsageDraft(
  draft: UsagePricingInput,
  options: PriceUsageDraftOptions = {},
): PricedUsageDraft {
  const occurredAt = draft.occurredAt ?? (options.now?.() ?? new Date()).toISOString();

  if (draft.reason === "ran_off_platform") {
    return {
      occurredAt,
      period: usagePeriodFromDate(new Date(occurredAt)),
      rateVersion: null,
      unitCostMicros: null,
      costMicros: 0,
      creditMicros: 0,
      billable: false,
      byok: false,
      estimated: false,
    };
  }

  const priced = priceUsage(
    draft.rates ?? [],
    {
      vendor: draft.vendor,
      resource: draft.resource,
      unit: draft.unit,
      occurredAt,
      ...(draft.tier ? { tier: draft.tier } : {}),
    },
    draft.quantity,
    {
      onMissingRate: options.onMissingRate,
    },
  );

  const byok = draft.byok === true;
  const exemptFromCredits = byok && BYOK_EXEMPT_SOURCES.has(draft.source);
  const costMicros = Math.round(priced.costMicros);

  return {
    occurredAt,
    period: usagePeriodFromDate(new Date(occurredAt)),
    rateVersion: priced.rateVersion,
    unitCostMicros: priced.unitCostMicros,
    costMicros,
    creditMicros: exemptFromCredits
      ? 0
      : creditMicrosFromCostMicros(costMicros, draft.margin ?? DEFAULT_MARGIN),
    billable: !exemptFromCredits,
    byok,
    estimated: priced.estimated,
  };
}
