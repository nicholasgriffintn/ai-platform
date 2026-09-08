import { z } from "zod";

export const ollamaVersionSchema = z.object({ version: z.string() });

export const ollamaTagsSchema = z.object({ models: z.array(z.object({ model: z.string() })) });
export const ollamaChunkSchema = z.object({
  message: z.object({ content: z.string() }).optional(),
  done: z.boolean().optional(),
  error: z.string().optional(),
});
