import z from "zod/v4";

import { takeoverHumanInTheLoopSchema } from "./human-in-the-loop.js";

export const REQUEST_SECRET_TOOL_NAME = "request_secret";
export const SECRET_REQUEST_RENDERER = "secret_request";
export const SECRET_REFERENCE_PREFIX = "secret-ref:";
export const SECRET_REFERENCE_TTL_SECONDS = 24 * 60 * 60;
export const SECRET_VALUE_MAX_LENGTH = 16_384;

const identifier = z.string().min(1).max(256);

export const secretReferenceSchema = z
  .string()
  .regex(/^secret-ref:[a-f0-9]{64}$/)
  .describe("Opaque one-use reference to a secret the user provided privately.");

export const secretDestinationSchema = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);

    return url.protocol === "https:" && !url.username && !url.password;
  }, "Destination must be an https URL without credentials");

export const requestSecretInputSchema = z
  .object({
    label: z.string().trim().min(1).max(120),
    purpose: z.string().trim().min(1).max(500),
    destination: secretDestinationSchema.optional(),
  })
  .strict();

const FORBIDDEN_SECRET_HEADERS = new Set([
  "connection",
  "content-length",
  "content-type",
  "cookie",
  "host",
  "transfer-encoding",
]);

export const secretHeaderAuthSchema = z
  .object({
    secret_ref: secretReferenceSchema,
    header: z
      .string()
      .regex(/^[A-Za-z0-9-]{1,64}$/)
      .refine((name) => !FORBIDDEN_SECRET_HEADERS.has(name.toLowerCase()))
      .default("Authorization"),
    scheme: z.enum(["bearer", "raw"]).default("bearer"),
  })
  .strict();

export const secretRequestViewDataSchema = z.object({
  renderer: z.literal(SECRET_REQUEST_RENDERER),
  interactionId: identifier,
  label: z.string().min(1).max(120),
  purpose: z.string().min(1).max(500),
  destination: z.string().nullable(),
  humanInTheLoop: takeoverHumanInTheLoopSchema.optional(),
});

export const submitSecretRequestSchema = z
  .object({
    interaction_id: identifier,
    value: z.string().min(1).max(SECRET_VALUE_MAX_LENGTH),
  })
  .strict();

export const secretRequestSubmissionSchema = z.object({
  object: z.literal("secret_reference"),
  reference: secretReferenceSchema,
  label: z.string(),
  destination: z.string().nullable(),
  expires_at: z.string(),
});

export type RequestSecretInput = z.infer<typeof requestSecretInputSchema>;
export type SecretHeaderAuth = z.infer<typeof secretHeaderAuthSchema>;
export type SecretRequestViewData = z.infer<typeof secretRequestViewDataSchema>;
export type SubmitSecretRequest = z.infer<typeof submitSecretRequestSchema>;
export type SecretRequestSubmission = z.infer<typeof secretRequestSubmissionSchema>;
