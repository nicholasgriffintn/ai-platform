import { z } from "zod";

export const planSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stripe_price_id: z.string(),
});

export const plansResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(planSchema),
});

export const planResponseSchema = z.object({
  success: z.boolean(),
  data: planSchema,
});

export const planParamsSchema = z.object({ id: z.string() });
