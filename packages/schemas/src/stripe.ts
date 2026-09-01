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

export const overageUpdateSchema = z.object({
  enabled: z.boolean(),
});

export const overageStatusResponseSchema = z.object({
  overage_enabled: z.boolean(),
});
