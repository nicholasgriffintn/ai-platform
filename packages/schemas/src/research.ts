import z from "zod/v4";

export const researchCitationSchema = z.object({
  title: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  excerpts: z.array(z.string()).optional(),
});

export const researchFieldBasisSchema = z.object({
  field: z.string(),
  reasoning: z.string().optional(),
  confidence: z.string().optional(),
  citations: z.array(researchCitationSchema).optional(),
});

export const researchOutputSchema = z.object({
  content: z.unknown(),
  basis: z.array(researchFieldBasisSchema).optional(),
  type: z.string().optional(),
});

export const researchRunSchema = z
  .object({
    run_id: z.string(),
    status: z.string(),
    is_active: z.boolean(),
    warnings: z.array(z.string()).nullable().optional(),
    processor: z.string(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
    created_at: z.string(),
    modified_at: z.string(),
    error: z.string().nullable().optional(),
    taskgroup_id: z.string().nullable().optional(),
  })
  .passthrough();

export const researchPollMetadataSchema = z.object({
  interval_ms: z.number().optional(),
  timeout_seconds: z.number().optional(),
  attempts: z.number().optional(),
  elapsed_ms: z.number().optional(),
});

export const researchStatusSchema = z.object({
  provider: z.string(),
  run: researchRunSchema,
  output: researchOutputSchema.optional(),
  warnings: z.array(z.string()).nullable().optional(),
  poll: researchPollMetadataSchema.optional(),
});

export type ResearchCitation = z.infer<typeof researchCitationSchema>;
export type ResearchFieldBasis = z.infer<typeof researchFieldBasisSchema>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;
export type ResearchRun = z.infer<typeof researchRunSchema>;
export type ResearchPollMetadata = z.infer<typeof researchPollMetadataSchema>;
export type ResearchStatus = z.infer<typeof researchStatusSchema>;
