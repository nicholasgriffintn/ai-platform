import z from "zod/v4";

export const EVIDENCE_VERDICTS = [
  "supported",
  "partially_supported",
  "unsupported",
  "contradicted",
] as const;

export const evidenceVerdictSchema = z.enum(EVIDENCE_VERDICTS);
export type EvidenceVerdict = z.infer<typeof evidenceVerdictSchema>;

export const evidenceAuditSourceSchema = z
  .object({
    url: z.url().max(2_048),
    quotedText: z.string().trim().min(1).max(2_000).optional(),
  })
  .strict();

export const evidenceAuditClaimSchema = z
  .object({
    id: z.string().trim().min(1).max(128).optional(),
    claim: z.string().trim().min(1).max(4_000),
    sources: z.array(evidenceAuditSourceSchema).min(1).max(5),
  })
  .strict();
export type EvidenceAuditClaim = z.infer<typeof evidenceAuditClaimSchema>;

export const evidenceAuditInputSchema = z
  .object({
    claims: z
      .array(evidenceAuditClaimSchema)
      .min(1)
      .max(8)
      .superRefine((claims, context) => {
        const uniqueUrls = new Set(claims.flatMap((claim) => claim.sources.map(({ url }) => url)));

        if (uniqueUrls.size > 10) {
          context.addIssue({
            code: "custom",
            message: "An evidence audit can extract at most 10 unique source URLs",
          });
        }
      }),
  })
  .strict();
export type EvidenceAuditInput = z.infer<typeof evidenceAuditInputSchema>;

export const evidenceAuditFindingSchema = z
  .object({
    id: z.string().min(1).max(128),
    claim: z.string().min(1).max(4_000),
    verdict: evidenceVerdictSchema,
    confidence: z.number().min(0).max(1),
    probabilities: z.record(z.string(), z.number().min(0).max(1)),
    sources: z.array(z.url().max(2_048)).min(1).max(5),
  })
  .strict();
export type EvidenceAuditFinding = z.infer<typeof evidenceAuditFindingSchema>;

export const evidenceAuditFailedSourceSchema = z
  .object({
    url: z.url().max(2_048),
    error: z.string().max(1_000),
  })
  .strict();

export const evidenceAuditResultSchema = z
  .object({
    findings: z.array(evidenceAuditFindingSchema).min(1).max(8),
    failedSources: z.array(evidenceAuditFailedSourceSchema).max(10),
    provider: z.string().min(1),
    model: z.string().min(1),
  })
  .strict();
export type EvidenceAuditResult = z.infer<typeof evidenceAuditResultSchema>;

export const evidenceAuditToolDataSchema = evidenceAuditResultSchema.extend({
  renderer: z.literal("evidence_audit"),
});
export type EvidenceAuditToolData = z.infer<typeof evidenceAuditToolDataSchema>;
