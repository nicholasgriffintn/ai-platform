import z from "zod/v4";

export const cloudflareWebSearchResponseSchema = z.object({
  items: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      description: z.string().optional(),
    }),
  ),
  metadata: z
    .object({
      query: z.string().optional(),
      requestId: z.string().optional(),
      latencyMs: z.number().optional(),
    })
    .optional(),
});

export const cloudflareAiSearchResponseSchema = z.object({
  success: z.literal(true),
  result: z
    .object({
      chunks: z.array(
        z
          .object({
            id: z.string(),
            score: z.number(),
            text: z.string(),
            type: z.string(),
            item: z
              .object({
                key: z.string(),
                metadata: z.record(z.string(), z.unknown()).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      ),
      search_query: z.string().optional(),
    })
    .passthrough(),
});

export type CloudflareAiSearchResponse = z.infer<typeof cloudflareAiSearchResponseSchema>;
