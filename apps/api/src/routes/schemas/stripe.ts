import z from "zod/v4";

export const checkoutSchema = z.object({
  plan_id: z.string(),
  success_url: z.url(),
  cancel_url: z.url(),
});
