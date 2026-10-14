import z from "zod/v4";

import { listSchema } from "./platform/list.js";

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stripe_price_id: z.string(),
  included_credits: z.number().int().nonnegative().nullable(),
  grace_credits: z.number().int().nonnegative().nullable(),
  overage_available: z.boolean(),
});

export type Plan = z.infer<typeof planSchema>;

export const plansResponseSchema = listSchema(planSchema);

export const planResponseSchema = z.object({
  success: z.boolean(),
  data: planSchema,
});

export const planParamsSchema = z.object({ plan_id: z.string().min(1) });

export const planCreditsUpdateSchema = z
  .object({
    included_credits: z.number().int().nonnegative().nullable().optional(),
    grace_credits: z.number().int().nonnegative().nullable().optional(),
    stripe_meter_id: z.string().min(1).nullable().optional(),
    overage_price_id: z.string().min(1).nullable().optional(),
  })
  .refine((value) => Object.values(value).some((field) => field !== undefined), {
    message: "At least one plan credit field is required",
  });

export type PlanCreditsUpdate = z.infer<typeof planCreditsUpdateSchema>;
