import z from "zod/v4";

import { githubLoginSchema } from "./auth.js";
import { httpsOriginSchema, publicHttpsUrlSchema } from "./urls.js";

export const oidcRoleMappingSchema = z.object({
  group: z.string().trim().min(1).max(200),
  role: z.enum(["admin", "member"]),
});
const roleMappings = z
  .array(oidcRoleMappingSchema)
  .min(1)
  .max(50)
  .refine(
    (mappings) => new Set(mappings.map((mapping) => mapping.group)).size === mappings.length,
    "Map each identity group once",
  );
const connectionFields = {
  label: z.string().trim().min(2).max(80),
  allowedOrigins: z.array(httpsOriginSchema).max(8).default([]),
  signingAlgorithm: z.enum(["RS256", "ES256"]).default("RS256"),
  groupsClaim: z.string().trim().min(1).max(200).default("groups"),
  roleMappings,
  enabled: z.boolean().default(true),
};

export const createOidcConnectionSchema = z.object({
  ...connectionFields,
  issuer: publicHttpsUrlSchema
    .refine((value) => !new URL(value).search, "Issuer must not contain a query")
    .transform((value) => new URL(value).href),
  clientId: z.string().trim().min(1).max(500),
  clientSecret: z.string().min(1).max(4096),
});
export const updateOidcConnectionSchema = z.object({
  ...connectionFields,
  expectedRevision: z.number().int().positive(),
  clientSecret: z.string().min(1).max(4096).optional(),
});
export const oidcConnectionSchema = createOidcConnectionSchema.omit({ clientSecret: true }).extend({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string().nullable(),
});
export const oidcConnectionResponseSchema = z.object({
  connection: oidcConnectionSchema.nullable(),
});
export const oidcLoginQuerySchema = githubLoginSchema.extend({
  link: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});
export const oidcCallbackQuerySchema = z.object({
  code: z.string().min(1).max(16_384),
  state: z.string().min(1).max(4096),
});
export const oidcConnectionParamsSchema = z.object({ connectionId: z.uuid() });
export const linkedOidcIdentitySchema = z.object({
  connectionId: z.uuid(),
  workspaceId: z.string().min(1),
  workspaceName: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  accessExpiresAt: z.string().nullable(),
});
export const linkedOidcIdentitiesResponseSchema = z.object({
  identities: z.array(linkedOidcIdentitySchema),
});

export type OidcConnection = z.infer<typeof oidcConnectionSchema>;
export type CreateOidcConnection = z.infer<typeof createOidcConnectionSchema>;
export type UpdateOidcConnection = z.infer<typeof updateOidcConnectionSchema>;
export type OidcRoleMapping = z.infer<typeof oidcRoleMappingSchema>;
export type OidcLoginQuery = z.infer<typeof oidcLoginQuerySchema>;
export type LinkedOidcIdentity = z.infer<typeof linkedOidcIdentitySchema>;
