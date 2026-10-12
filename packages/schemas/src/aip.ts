import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

export const AIP_VERSION = "0.1" as const;
export const AIP_SIGNED_FIELDS = [
  "identity",
  "memory",
  "configuration",
  "learned_behaviors",
] as const;

export const aipPersistentMemorySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  importance: z.number().min(0).max(1).optional(),
  created_at: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const aipBundleSchema = z.object({
  aip_version: z.literal(AIP_VERSION),
  created_at: z.string(),
  exported_by: z.object({
    platform: z.literal("polychat"),
    version: z.string(),
    instance: z.string(),
  }),
  identity: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string(),
    personality: z.string().optional(),
  }),
  memory: z.object({
    version: z.literal(1),
    exported_at: z.string(),
    persistent: z.array(aipPersistentMemorySchema),
    entities: z.array(z.record(z.string(), z.unknown())),
    relations: z.array(z.record(z.string(), z.unknown())),
  }),
  configuration: z.object({
    model_preferences: z.record(z.string(), z.string()),
  }),
  learned_behaviors: z.object({
    workflow_preferences: z.object({
      prefers_confirmation_before: z.array(z.string()),
      auto_approves: z.array(z.string()),
    }),
  }),
  metadata: z.object({
    export_includes: z.array(z.string()),
    export_excludes: z.array(z.string()),
  }),
  signature: z.object({
    algorithm: z.literal("Ed25519"),
    public_key: z.string().min(1),
    signed_fields: z.array(z.enum(AIP_SIGNED_FIELDS)),
    signature: z.string().min(1),
    signed_at: z.string(),
  }),
});

export type AipBundle = z.infer<typeof aipBundleSchema>;
export type AipPersistentMemory = z.infer<typeof aipPersistentMemorySchema>;
export type AipUnsignedBundle = Omit<AipBundle, "signature">;

export function aipSignedPayload(bundle: AipUnsignedBundle): string {
  return canonicalJson(
    Object.fromEntries(AIP_SIGNED_FIELDS.map((field) => [field, bundle[field]])),
  );
}
