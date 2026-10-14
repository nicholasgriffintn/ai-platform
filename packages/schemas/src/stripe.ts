import z from "zod/v4";

export const checkoutSchema = z.object({
  plan_id: z.string(),
  success_url: z.url(),
  cancel_url: z.url(),
});

export const billingPortalSchema = z.object({
  return_url: z.url(),
});

export const billingPortalResponseSchema = z.object({
  url: z.string(),
});

export const updateSubscriptionSchema = z
  .object({
    overage_enabled: z.boolean().optional(),
    cancel_at_period_end: z.boolean().optional(),
  })
  .refine(
    (update) => update.overage_enabled !== undefined || update.cancel_at_period_end !== undefined,
    { error: "Set overage_enabled or cancel_at_period_end" },
  );

export const subscriptionUpdateResponseSchema = z.object({
  overage_enabled: z.boolean().optional(),
  status: z.string().optional(),
  cancel_at_period_end: z.boolean().optional(),
  days_until_due: z.number().optional(),
});

export type UpdateSubscription = z.infer<typeof updateSubscriptionSchema>;
export type SubscriptionUpdateResponse = z.infer<typeof subscriptionUpdateResponseSchema>;
