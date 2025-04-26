import { z } from "zod";
import "zod-openapi/extend";

export const checkoutSchema = z.object({
  plan_id: z.string(),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
});
