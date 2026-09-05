import z from "zod/v4";

import { sandboxServiceNameSchema, sandboxServicePortSchema } from "./sandbox-services";

export const SANDBOX_PREVIEW_ACCESS_TTL_SECONDS = 5 * 60;
export const SANDBOX_PREVIEW_BOOTSTRAP_TTL_SECONDS = 60;
export const SANDBOX_PREVIEW_GRANT_AUDIENCE = "assistant-sandbox-preview";

export const sandboxPreviewIdSchema = z
  .string()
  .trim()
  .min(16)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/);

export const sandboxPreviewOriginIdSchema = z
  .string()
  .trim()
  .length(24)
  .regex(/^[a-z0-9]+$/);

export const sandboxPreviewStateSchema = z.enum([
  "starting",
  "healthy",
  "unhealthy",
  "stopped",
  "expired",
]);

export const sandboxPreviewGrantPurposeSchema = z.enum(["exposure", "bootstrap", "session"]);

export const sandboxPreviewGrantClaimsSchema = z
  .object({
    aud: z.literal(SANDBOX_PREVIEW_GRANT_AUDIENCE),
    exp: z.number().int().positive(),
    iat: z.number().int().positive(),
    iss: z.literal("assistant"),
    jti: sandboxPreviewIdSchema,
    origin_id: sandboxPreviewOriginIdSchema,
    port: sandboxServicePortSchema,
    preview_id: sandboxPreviewIdSchema,
    project_id: z.string().trim().min(1),
    purpose: sandboxPreviewGrantPurposeSchema,
    run_id: z.string().trim().min(1),
    service_name: sandboxServiceNameSchema,
    sub: z.string().regex(/^[1-9]\d*$/),
  })
  .passthrough();

export const createSandboxPreviewRequestSchema = z
  .object({
    serviceName: sandboxServiceNameSchema,
  })
  .strict();

export const sandboxPreviewParamsSchema = z.object({
  runId: z.string().trim().min(1),
  previewId: sandboxPreviewIdSchema,
});

export const sandboxPreviewAccessSchema = z
  .object({
    previewId: sandboxPreviewIdSchema,
    runId: z.string().trim().min(1),
    serviceName: sandboxServiceNameSchema,
    state: sandboxPreviewStateSchema,
    expiresAt: z.string().trim().min(1),
    url: z.url().optional(),
  })
  .strict();

export const sandboxPreviewExposureRequestSchema = z
  .object({
    grant: z.string().trim().min(1).max(4096),
  })
  .strict();

export const sandboxPreviewExposureResponseSchema = z
  .object({
    forwardToken: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .regex(/^[a-z0-9_]+$/),
  })
  .strict();

export const sandboxPreviewAuthorisationRequestSchema = z
  .object({
    credential: z.string().trim().min(1).max(4096),
    mode: z.enum(["bootstrap", "session"]),
    originId: sandboxPreviewOriginIdSchema,
  })
  .strict();

export const sandboxPreviewConsumeRequestSchema = z
  .object({
    bootstrapJti: sandboxPreviewIdSchema,
  })
  .strict();

export const sandboxPreviewAuthorisationResponseSchema = z
  .object({
    expiresAt: z.string().trim().min(1),
    forwardToken: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .regex(/^[a-z0-9_]+$/),
    port: sandboxServicePortSchema,
    runId: z.string().trim().min(1),
    serviceName: sandboxServiceNameSchema,
    sessionToken: z.string().trim().min(1).max(4096).optional(),
  })
  .strict();

export const sandboxPreviewSessionRecordSchema = z
  .object({
    previewId: sandboxPreviewIdSchema,
    originId: sandboxPreviewOriginIdSchema,
    userId: z.number().int().positive(),
    projectId: z.string().trim().min(1),
    serviceName: sandboxServiceNameSchema,
    port: sandboxServicePortSchema,
    forwardToken: z
      .string()
      .trim()
      .min(1)
      .max(16)
      .regex(/^[a-z0-9_]+$/),
    bootstrapJti: sandboxPreviewIdSchema,
    sessionJti: sandboxPreviewIdSchema,
    createdAt: z.string().trim().min(1),
    expiresAt: z.string().trim().min(1),
    bootstrapConsumedAt: z.string().trim().min(1).optional(),
    revokedAt: z.string().trim().min(1).optional(),
  })
  .strict();

export type CreateSandboxPreviewRequest = z.infer<typeof createSandboxPreviewRequestSchema>;
export type SandboxPreviewAccess = z.infer<typeof sandboxPreviewAccessSchema>;
export type SandboxPreviewState = z.infer<typeof sandboxPreviewStateSchema>;
export type SandboxPreviewGrantClaims = z.infer<typeof sandboxPreviewGrantClaimsSchema>;
export type SandboxPreviewGrantPurpose = z.infer<typeof sandboxPreviewGrantPurposeSchema>;
export type SandboxPreviewExposureRequest = z.infer<typeof sandboxPreviewExposureRequestSchema>;
export type SandboxPreviewExposureResponse = z.infer<typeof sandboxPreviewExposureResponseSchema>;
export type SandboxPreviewAuthorisationRequest = z.infer<
  typeof sandboxPreviewAuthorisationRequestSchema
>;
export type SandboxPreviewAuthorisationResponse = z.infer<
  typeof sandboxPreviewAuthorisationResponseSchema
>;
export type SandboxPreviewSessionRecord = z.infer<typeof sandboxPreviewSessionRecordSchema>;
