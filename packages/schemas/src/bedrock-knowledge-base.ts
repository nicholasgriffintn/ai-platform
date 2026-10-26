import z from "zod/v4";

export const bedrockKnowledgeBaseRetrieveResponseSchema = z.object({
  retrievalResults: z.array(
    z
      .object({
        content: z.object({ text: z.string().optional() }).passthrough(),
        location: z
          .object({
            type: z.string().optional(),
            s3Location: z.object({ uri: z.string() }).partial().optional(),
            webLocation: z.object({ url: z.string() }).partial().optional(),
            confluenceLocation: z.object({ url: z.string() }).partial().optional(),
            salesforceLocation: z.object({ url: z.string() }).partial().optional(),
            sharePointLocation: z.object({ url: z.string() }).partial().optional(),
          })
          .passthrough()
          .optional(),
        score: z.number().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough(),
  ),
});

export type BedrockKnowledgeBaseRetrieveResponse = z.infer<
  typeof bedrockKnowledgeBaseRetrieveResponseSchema
>;
