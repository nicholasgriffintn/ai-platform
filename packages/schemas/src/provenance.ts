import z from "zod/v4";

export const PROVENANCE_PROTOCOL_VERSION = 1 as const;
export const MAX_OUTPUT_PROVENANCE_SKILLS = 64;
export const MAX_OUTPUT_PROVENANCE_SOURCES = 100;
export const MAX_OUTPUT_PROVENANCE_APPROVALS = 100;

export const provenanceCompletenessSchema = z.enum(["complete", "partial", "legacy"]);
export const outputProvenanceOriginSchema = z.enum([
  "generated",
  "user",
  "imported",
  "unknown",
  "legacy",
]);

export const provenanceRunSchema = z
  .object({
    id: z.string().min(1).max(256),
    attempt: z.number().int().positive(),
  })
  .strict();

export const provenanceModelSchema = z
  .object({
    id: z.string().min(1).max(256),
    provider: z.string().min(1).max(128),
  })
  .strict();

export const provenanceSkillSchema = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(512),
    revisionId: z.string().min(1).max(256).optional(),
    revision: z.number().int().positive().optional(),
  })
  .strict();

export const provenanceSourceSchema = z
  .object({
    id: z.string().min(1).max(256),
    name: z.string().min(1).max(512).nullable(),
    state: z.enum(["referenced", "unavailable"]),
  })
  .strict();

export const provenanceApprovalSchema = z
  .object({
    id: z.string().min(1).max(256),
    type: z.enum(["approval", "question"]),
    status: z.enum(["pending", "approved", "rejected", "resolved", "expired", "interrupted"]),
    toolName: z.string().min(1).max(256).nullable(),
  })
  .strict();

export const outputProvenanceSchema = z
  .object({
    protocolVersion: z.literal(PROVENANCE_PROTOCOL_VERSION),
    capturedAt: z.string().max(64),
    completeness: provenanceCompletenessSchema,
    origin: outputProvenanceOriginSchema,
    run: provenanceRunSchema.nullable(),
    model: provenanceModelSchema.nullable(),
    skills: z.array(provenanceSkillSchema).max(MAX_OUTPUT_PROVENANCE_SKILLS),
    sources: z.array(provenanceSourceSchema).max(MAX_OUTPUT_PROVENANCE_SOURCES),
    approvals: z.array(provenanceApprovalSchema).max(MAX_OUTPUT_PROVENANCE_APPROVALS),
  })
  .strict();

export type ProvenanceCompleteness = z.infer<typeof provenanceCompletenessSchema>;
export type ProvenanceRun = z.infer<typeof provenanceRunSchema>;
export type ProvenanceModel = z.infer<typeof provenanceModelSchema>;
export type ProvenanceSkill = z.infer<typeof provenanceSkillSchema>;
export type ProvenanceSource = z.infer<typeof provenanceSourceSchema>;
export type ProvenanceApproval = z.infer<typeof provenanceApprovalSchema>;
export type OutputProvenance = z.infer<typeof outputProvenanceSchema>;
