import z from "zod/v4";

export const outputKindSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9._-]*$/);

export const outputStatusSchema = z.enum(["pending", "ready", "failed", "archived"]);
export const outputSensitivitySchema = z.enum(["personal", "internal", "confidential"]);

export const outputFileSchema = z
  .object({
    key: z.string().min(1).max(1024),
    mimeType: z.string().min(1).max(255),
    filename: z.string().max(255).nullable(),
    byteSize: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const outputSchema = z
  .object({
    id: z.string().min(1),
    createdByUserId: z.number().int().positive(),
    projectId: z.string().nullable(),
    conversationId: z.string().nullable(),
    parentOutputId: z.string().nullable(),
    capabilityId: z.string().trim().min(1).max(160),
    groupId: z.string().max(200).nullable(),
    kind: outputKindSchema,
    title: z.string().trim().min(1).max(200),
    status: outputStatusSchema,
    sensitivity: outputSensitivitySchema,
    content: z.record(z.string(), z.unknown()),
    file: outputFileSchema.nullable(),
    revision: z.number().int().positive(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const outputSummarySchema = outputSchema.omit({ content: true });

const outputScopeFields = {
  projectId: z.string().min(1).nullable().optional(),
  conversationId: z.string().min(1).nullable().optional(),
};

export const createOutputSchema = z
  .object({
    ...outputScopeFields,
    parentOutputId: z.string().min(1).nullable().optional(),
    capabilityId: z.string().trim().min(1).max(160),
    groupId: z.string().trim().min(1).max(200).nullable().optional(),
    kind: outputKindSchema,
    title: z.string().trim().min(1).max(200),
    status: outputStatusSchema.default("ready"),
    sensitivity: outputSensitivitySchema.optional(),
    content: z.record(z.string(), z.unknown()).default({}),
    file: outputFileSchema.nullable().optional(),
  })
  .strict();

export const updateOutputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    status: outputStatusSchema.optional(),
    sensitivity: outputSensitivitySchema.optional(),
    content: z.record(z.string(), z.unknown()).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict()
  .refine(
    (value) =>
      value.title !== undefined ||
      value.status !== undefined ||
      value.sensitivity !== undefined ||
      value.content !== undefined,
    { error: "At least one output field must be provided" },
  );

export const outputListResponseSchema = z
  .object({ outputs: z.array(outputSummarySchema) })
  .strict();

export const outputListQuerySchema = z
  .object({
    projectId: z.string().min(1).optional(),
    capabilityId: z.string().trim().min(1).max(160).optional(),
    kind: outputKindSchema.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const sharedOutputFileSchema = outputFileSchema.omit({ key: true });

export const sharedOutputSchema = z
  .object({
    id: z.string().min(1),
    capabilityId: z.string().trim().min(1).max(160),
    kind: outputKindSchema,
    title: z.string().trim().min(1).max(200),
    status: outputStatusSchema,
    content: z.record(z.string(), z.unknown()),
    file: sharedOutputFileSchema.nullable(),
    createdAt: z.string(),
    updatedAt: z.string().nullable(),
  })
  .strict();

export const outputRevisionSchema = z
  .object({
    outputId: z.string().min(1),
    revision: z.number().int().positive(),
    title: z.string().min(1),
    status: outputStatusSchema,
    sensitivity: outputSensitivitySchema,
    content: z.record(z.string(), z.unknown()),
    createdByUserId: z.number().int().positive(),
    createdAt: z.string(),
  })
  .strict();

export const createOutputShareSchema = z
  .object({ expiresAt: z.iso.datetime().nullable().optional() })
  .strict();

export const outputShareSchema = z
  .object({
    id: z.string().min(1),
    outputId: z.string().min(1),
    permission: z.literal("view"),
    expiresAt: z.string().nullable(),
    revokedAt: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict();

export const outputShareDeliverySchema = z
  .object({ share: outputShareSchema, token: z.string().min(32) })
  .strict();

export const outputShareListResponseSchema = z
  .object({ shares: z.array(outputShareSchema) })
  .strict();

export type OutputKind = z.infer<typeof outputKindSchema>;
export type OutputStatus = z.infer<typeof outputStatusSchema>;
export type OutputSensitivity = z.infer<typeof outputSensitivitySchema>;
export type OutputFile = z.infer<typeof outputFileSchema>;
export type Output = z.infer<typeof outputSchema>;
export type OutputSummary = z.infer<typeof outputSummarySchema>;
export type SharedOutput = z.infer<typeof sharedOutputSchema>;
export type CreateOutputInput = z.infer<typeof createOutputSchema>;
export type UpdateOutputInput = z.infer<typeof updateOutputSchema>;
export type OutputRevision = z.infer<typeof outputRevisionSchema>;
export type OutputShare = z.infer<typeof outputShareSchema>;
