import z from "zod/v4";

export const INTERNAL_SERVICE_AUTHORIZATION_HEADER = "X-Polychat-Service-Authorization";
export const INTERNAL_SERVICE_TOKEN_AUDIENCE = "assistant-internal-service";
export const INTERNAL_SERVICE_TOKEN_TTL_SECONDS = 30;

export const internalServiceNameSchema = z.enum(["sandbox-worker"]);
export const internalServiceScopeSchema = z.enum(["sandbox-preview:authorise"]);

export const internalServiceTokenClaimsSchema = z
  .object({
    aud: z.literal(INTERNAL_SERVICE_TOKEN_AUDIENCE),
    exp: z.number().int().positive(),
    iat: z.number().int().positive(),
    iss: z.literal("assistant"),
    jti: z.uuid(),
    scopes: z.array(internalServiceScopeSchema).min(1),
    sub: internalServiceNameSchema,
  })
  .passthrough();

export type InternalServiceName = z.infer<typeof internalServiceNameSchema>;
export type InternalServiceScope = z.infer<typeof internalServiceScopeSchema>;
export type InternalServiceTokenClaims = z.infer<typeof internalServiceTokenClaimsSchema>;
