import { MICRO_CREDITS_PER_CREDIT, usagePeriodFromDate } from "@ngriffin_uk/polychat-schemas";

import { isDuplicateMeterEventError } from "~/lib/billing/stripeErrors";
import type { RepositoryManager } from "~/repositories";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/billing/stripe-overage-sync" });

export interface MeterEventCreateParams {
  event_name: string;
  identifier: string;
  timestamp: number;
  payload: Record<string, string>;
}

export interface MeterEventClient {
  billing: {
    meterEvents: {
      create(params: MeterEventCreateParams): Promise<unknown>;
    };
  };
}

export interface OverageSyncDelta {
  wholeCredits: number;
  syncedMicros: number;
}

export interface StripeOverageSyncResult {
  candidates: number;
  sent: number;
  markedAfterDuplicate: number;
  skippedNoMeter: number;
  skippedBelowOneCredit: number;
  failed: number;
}

export function overageSyncHourIso(date: Date): string {
  return `${date.toISOString().slice(0, 13)}:00:00Z`;
}

export function overageMeterEventIdentifier(customerId: string, hourIso: string): string {
  return `${customerId}:${hourIso}`;
}

export function computeOverageSyncDelta(
  overageCreditMicros: number,
  syncedCreditMicros: number,
): OverageSyncDelta {
  const pendingMicros = Math.max(0, overageCreditMicros - syncedCreditMicros);
  const wholeCredits = Math.floor(pendingMicros / MICRO_CREDITS_PER_CREDIT);

  return { wholeCredits, syncedMicros: wholeCredits * MICRO_CREDITS_PER_CREDIT };
}

export async function runStripeOverageSync(
  repositories: RepositoryManager,
  stripe: MeterEventClient,
  now: Date = new Date(),
): Promise<StripeOverageSyncResult> {
  const period = usagePeriodFromDate(now);
  const hourIso = overageSyncHourIso(now);
  const timestamp = Math.floor(Date.parse(hourIso) / 1000);
  const candidates = await repositories.usageBalances.listOverageSyncCandidates(period);

  const result: StripeOverageSyncResult = {
    candidates: candidates.length,
    sent: 0,
    markedAfterDuplicate: 0,
    skippedNoMeter: 0,
    skippedBelowOneCredit: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    if (!candidate.stripe_meter_id) {
      logger.debug("Skipping overage sync for a plan without a Stripe meter", {
        userId: candidate.user_id,
        period: candidate.period,
      });
      result.skippedNoMeter += 1;
      continue;
    }

    const delta = computeOverageSyncDelta(
      candidate.overage_credit_micros,
      candidate.stripe_synced_overage_credit_micros,
    );

    if (delta.wholeCredits <= 0) {
      result.skippedBelowOneCredit += 1;
      continue;
    }

    const identifier = overageMeterEventIdentifier(candidate.stripe_customer_id, hourIso);

    try {
      await stripe.billing.meterEvents.create({
        event_name: candidate.stripe_meter_id,
        identifier,
        timestamp,
        payload: {
          stripe_customer_id: candidate.stripe_customer_id,
          value: String(delta.wholeCredits),
        },
      });

      await repositories.usageBalances.recordStripeSyncedOverage(
        candidate.user_id,
        candidate.period,
        delta.syncedMicros,
      );
      result.sent += 1;
    } catch (error) {
      if (isDuplicateMeterEventError(error)) {
        await repositories.usageBalances.recordStripeSyncedOverage(
          candidate.user_id,
          candidate.period,
          delta.syncedMicros,
        );
        result.markedAfterDuplicate += 1;
        logger.warn("Meter event already existed for this hour, marked overage as synced", {
          userId: candidate.user_id,
          identifier,
        });
        continue;
      }

      result.failed += 1;
      logger.error("Failed to send overage meter event", {
        userId: candidate.user_id,
        identifier,
        error,
      });
    }
  }

  return result;
}
