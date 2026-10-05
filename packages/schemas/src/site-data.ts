import z from "zod/v4";

export const siteDataIdentifierSchema = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const siteDataFieldNameSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9_]{0,63}$/)
  .refine((value) => !["constructor", "prototype"].includes(value));

export const siteSourceBindingSchema = z
  .object({
    kind: z.literal("source"),
    sourceId: z.string().min(1).max(200),
    pageId: siteDataIdentifierSchema,
    statePath: z
      .string()
      .max(128)
      .regex(/^\/[a-zA-Z][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9_-]+)*$/)
      .refine(
        (value) =>
          !value
            .split("/")
            .some((part) => ["__proto__", "constructor", "prototype"].includes(part)),
      ),
  })
  .strict();

export const siteDataBindingSchema = siteSourceBindingSchema;

export const siteIntegrationScopeSchema = z
  .object({
    projectId: z.string().min(1).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const siteDataResponseSchema = z
  .object({
    revision: z.number().int().positive(),
    bindings: z.record(siteDataIdentifierSchema, z.unknown()),
  })
  .strict();

export type SiteDataBinding = z.infer<typeof siteDataBindingSchema>;
export type SiteIntegrationScope = z.infer<typeof siteIntegrationScopeSchema>;
export type SiteDataResponse = z.infer<typeof siteDataResponseSchema>;
