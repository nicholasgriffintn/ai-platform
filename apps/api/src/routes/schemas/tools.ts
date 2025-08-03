import { z } from "zod/v4";

export const toolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
});

export const toolsResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.array(toolSchema),
});
