import z from "zod/v4";

import { recipeConnectorProviderSchema } from "./apps.js";

export const MAX_ARTIFACT_BINDINGS = 8;
export const ARTIFACT_BINDING_MAX_RESULT_CHARS = 100_000;

export const artifactBindingArgValueSchema = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const artifactBindingArgsSchema = z
  .record(z.string().min(1).max(80), artifactBindingArgValueSchema)
  .refine((args) => Object.keys(args).length <= 20, {
    message: "A binding can declare up to 20 arguments",
  });

export type ArtifactBindingArgs = z.infer<typeof artifactBindingArgsSchema>;

export const artifactBindingSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "Binding ids are lowercase and use - or _ as separators"),
    provider: recipeConnectorProviderSchema,
    operation: z.string().trim().min(1).max(120),
    args: artifactBindingArgsSchema.default({}),
    label: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export type ArtifactBinding = z.infer<typeof artifactBindingSchema>;

export const artifactBindingsSchema = z
  .array(artifactBindingSchema)
  .max(MAX_ARTIFACT_BINDINGS)
  .refine((bindings) => new Set(bindings.map((binding) => binding.id)).size === bindings.length, {
    message: "Binding ids must be unique",
  });

export const artifactBindingReadRequestSchema = z
  .object({
    messageId: z.string().min(1).max(200),
    artifactIdentifier: z.string().min(1).max(200),
    bindingId: z.string().min(1).max(60),
    args: artifactBindingArgsSchema.optional(),
  })
  .strict();

export type ArtifactBindingReadRequest = z.infer<typeof artifactBindingReadRequestSchema>;

export const artifactBindingReadResponseSchema = z.object({
  data: z.unknown(),
  fetchedAt: z.string(),
  cached: z.boolean(),
});

export type ArtifactBindingReadResponse = z.infer<typeof artifactBindingReadResponseSchema>;
