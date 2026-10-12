import z from "zod/v4";

export const DEVICE_CODE_GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code" as const;
export const DEVICE_CODE_EXPIRES_IN_SECONDS = 600;
export const DEVICE_CODE_POLL_INTERVAL_SECONDS = 10;
export const DEVICE_USER_CODE_ALPHABET = "BCDFGHJKLMNPQRSTVWXZ";
export const DEVICE_USER_CODE_LENGTH = 8;

export function normaliseDeviceUserCode(input: string): string | null {
  const characters = input.toUpperCase().replace(/[\s-]/g, "");

  if (characters.length !== DEVICE_USER_CODE_LENGTH) {
    return null;
  }

  return [...characters].every((character) => DEVICE_USER_CODE_ALPHABET.includes(character))
    ? characters
    : null;
}

export function formatDeviceUserCode(userCode: string): string {
  return `${userCode.slice(0, 4)}-${userCode.slice(4)}`;
}

export const deviceCodeRequestSchema = z.object({
  client_name: z.string().trim().min(1).max(80),
});

export type DeviceCodeRequest = z.infer<typeof deviceCodeRequestSchema>;

export const deviceCodeResponseSchema = z.object({
  device_code: z.string().min(1),
  user_code: z.string().min(1),
  verification_uri: z.string().min(1),
  verification_uri_complete: z.string().min(1),
  expires_in: z.number().int().positive(),
  interval: z.number().int().positive(),
});

export type DeviceCodeResponse = z.infer<typeof deviceCodeResponseSchema>;

export const deviceTokenRequestSchema = z.object({
  grant_type: z.literal(DEVICE_CODE_GRANT_TYPE),
  device_code: z.string().trim().min(1).max(200),
});

export type DeviceTokenRequest = z.infer<typeof deviceTokenRequestSchema>;

export const deviceTokenErrorSchema = z.enum([
  "authorization_pending",
  "slow_down",
  "access_denied",
  "expired_token",
  "invalid_grant",
]);

export type DeviceTokenError = z.infer<typeof deviceTokenErrorSchema>;

export const deviceTokenResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal("Bearer"),
});

export type DeviceTokenResponse = z.infer<typeof deviceTokenResponseSchema>;

export const deviceAuthorisationSchema = z.object({
  userCode: z.string().min(1),
  clientName: z.string().min(1),
  createdAt: z.string(),
  expiresAt: z.string(),
});

export type DeviceAuthorisation = z.infer<typeof deviceAuthorisationSchema>;

export const deviceAuthorisationParamsSchema = z.object({
  userCode: z.string().trim().min(1).max(20),
});

export const deviceAuthorisationDecisionSchema = z.object({
  decision: z.enum(["approve", "deny"]),
});

export type DeviceAuthorisationDecision = z.infer<typeof deviceAuthorisationDecisionSchema>;
