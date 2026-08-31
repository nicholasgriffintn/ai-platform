import z from "zod/v4";

import { usageUnitSchema } from "./pricing/units";

export const USAGE_SOURCES = ["model", "hosted_tool", "capability", "infrastructure"] as const;

export const usageSourceSchema = z.enum(USAGE_SOURCES);

export type UsageSource = z.infer<typeof usageSourceSchema>;

export const CREDIT_STATES = ["ok", "reserve", "overage", "exhausted"] as const;

export const creditStateSchema = z.enum(CREDIT_STATES);

export type CreditState = z.infer<typeof creditStateSchema>;

export const USAGE_RESERVATION_KINDS = ["realtime", "sandbox"] as const;

export const usageReservationKindSchema = z.enum(USAGE_RESERVATION_KINDS);

export type UsageReservationKind = z.infer<typeof usageReservationKindSchema>;

export const USAGE_RESERVATION_STATUSES = ["held", "settled", "released"] as const;

export const usageReservationStatusSchema = z.enum(USAGE_RESERVATION_STATUSES);

export type UsageReservationStatus = z.infer<typeof usageReservationStatusSchema>;

export const USAGE_PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const usagePeriodSchema = z.string().regex(USAGE_PERIOD_PATTERN);

export function usagePeriodFromDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

export function usagePeriodResetsAt(period: string): string {
  const [year, month] = period.split("-").map(Number);

  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return usagePeriodResetsAt(usagePeriodFromDate());
  }

  return new Date(
    Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1),
  ).toISOString();
}

export const usageCreditsSummarySchema = z.object({
  included: z.number(),
  used: z.number(),
  reserved: z.number(),
  grace: z.number(),
  overrun: z.number(),
  overage: z.number(),
  overage_enabled: z.boolean(),
  state: creditStateSchema,
});

export type UsageCreditsSummary = z.infer<typeof usageCreditsSummarySchema>;

export const usageBalanceResponseSchema = z.object({
  period: usagePeriodSchema,
  resets_at: z.string(),
  plan_id: z.string().nullable(),
  credits: usageCreditsSummarySchema,
  credit_micros: z.object({
    included: z.number(),
    spent: z.number(),
    reserved: z.number(),
    grace: z.number(),
    overrun: z.number(),
    overage: z.number(),
  }),
  last_event_at: z.string().nullable(),
});

export type UsageBalanceResponse = z.infer<typeof usageBalanceResponseSchema>;

export const usageSummaryQuerySchema = z.object({
  period: usagePeriodSchema.optional(),
});

export type UsageSummaryQuery = z.infer<typeof usageSummaryQuerySchema>;

const usageSummaryGroupSchema = z.object({
  key: z.string(),
  cost_micros: z.number(),
  credit_micros: z.number(),
  credits: z.number(),
  event_count: z.number(),
});

export const usageSummaryResponseSchema = z.object({
  period: usagePeriodSchema,
  totals: z.object({
    cost_micros: z.number(),
    credit_micros: z.number(),
    credits: z.number(),
    event_count: z.number(),
  }),
  by_source: z.array(usageSummaryGroupSchema),
  by_vendor: z.array(usageSummaryGroupSchema),
});

export type UsageSummaryResponse = z.infer<typeof usageSummaryResponseSchema>;

export const usageEventsQuerySchema = z.object({
  period: usagePeriodSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type UsageEventsQuery = z.infer<typeof usageEventsQuerySchema>;

export const usageEventSchema = z.object({
  id: z.string(),
  occurred_at: z.string(),
  period: usagePeriodSchema,
  source: usageSourceSchema,
  vendor: z.string(),
  resource: z.string(),
  unit: usageUnitSchema,
  quantity: z.number(),
  cost_micros: z.number(),
  credit_micros: z.number(),
  credits: z.number(),
  billable: z.boolean(),
  byok: z.boolean(),
  estimated: z.boolean(),
  conversation_id: z.string().nullable(),
  project_id: z.string().nullable(),
  workspace_id: z.string().nullable(),
});

export type UsageEventRecord = z.infer<typeof usageEventSchema>;

export const usageEventsResponseSchema = z.object({
  period: usagePeriodSchema,
  events: z.array(usageEventSchema),
  next_cursor: z.string().nullable(),
});

export type UsageEventsResponse = z.infer<typeof usageEventsResponseSchema>;

const usageCounterSchema = z.object({
  used: z.number(),
  limit: z.number().nullable(),
});

export const usageLimitsSchema = z.object({
  daily: usageCounterSchema,
  credits: usageCreditsSummarySchema.optional(),
});

export type UsageLimitsPayload = z.infer<typeof usageLimitsSchema>;
