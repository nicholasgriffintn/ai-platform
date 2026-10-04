import z from "zod/v4";

export const knowledgeProxyFileSchema = z.object({
  url: z.url().max(4096),
  content_type: z
    .string()
    .regex(/^text\//i)
    .max(255),
  size: z
    .number()
    .int()
    .min(0)
    .max(256 * 1024),
  expires_at: z.iso.datetime({ offset: true }),
});
