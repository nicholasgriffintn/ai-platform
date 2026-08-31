export const MICRO_CREDITS_PER_CREDIT = 1_000_000;

export const USD_MICROS_PER_CREDIT = 10_000;

export const DEFAULT_MARGIN = 1.0;

export const MICRO_CREDITS_PER_USD_MICRO = MICRO_CREDITS_PER_CREDIT / USD_MICROS_PER_CREDIT;

export function creditMicrosFromCostMicros(
  costMicros: number,
  margin: number = DEFAULT_MARGIN,
): number {
  if (!Number.isFinite(costMicros) || !Number.isFinite(margin)) {
    return 0;
  }

  return Math.round(costMicros * margin * MICRO_CREDITS_PER_USD_MICRO);
}

export function creditsFromCreditMicros(creditMicros: number): number {
  if (!Number.isFinite(creditMicros)) {
    return 0;
  }

  return creditMicros / MICRO_CREDITS_PER_CREDIT;
}

export function creditMicrosFromCredits(credits: number): number {
  if (!Number.isFinite(credits)) {
    return 0;
  }

  return Math.round(credits * MICRO_CREDITS_PER_CREDIT);
}
