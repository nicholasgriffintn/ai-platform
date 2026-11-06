import z from "zod/v4";

export const mediaFingerprintSchema = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .meta({ description: "Lowercase SHA-256 of the file as downloaded." });

export const mediaProvenanceStatusSchema = z.enum([
  "marked",
  "provider-marked",
  "already-marked",
  "unsupported",
  "too-large",
]);

export const mediaProvenanceEntrySchema = z.object({
  fingerprint: mediaFingerprintSchema,
  status: mediaProvenanceStatusSchema,
  container: z.string().nullable(),
  markId: z.string().optional(),
  model: z.string().optional(),
  provider: z.string().optional(),
  recordedAt: z.string(),
});

export const mediaProvenanceKeySchema = z.object({
  kid: z.string(),
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  alg: z.literal("ES256"),
  use: z.literal("sig"),
  x: z.string(),
  y: z.string(),
});

export const mediaProvenanceKeysSchema = z.object({ keys: z.array(mediaProvenanceKeySchema) });

export type MediaProvenanceEntry = z.infer<typeof mediaProvenanceEntrySchema>;
export type MediaProvenanceKey = z.infer<typeof mediaProvenanceKeySchema>;
