import { importHmacSecret, signJwt, verifyJwt, type JwtClaims } from "@ngriffin_uk/auth-jwt";
import {
  INTERNAL_SERVICE_TOKEN_AUDIENCE,
  INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
  SANDBOX_PREVIEW_ACCESS_TTL_SECONDS,
  SANDBOX_PREVIEW_BOOTSTRAP_TTL_SECONDS,
  SANDBOX_PREVIEW_GRANT_AUDIENCE,
  sandboxPreviewGrantClaimsSchema,
  type SandboxPreviewGrantClaims,
  type SandboxPreviewGrantPurpose,
  type InternalServiceScope,
} from "@ngriffin_uk/polychat-schemas";

const ISSUER = "assistant";

function toPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : value;

  return typeof parsed === "number" && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function verifySignedJwt(
  token: string,
  secret: string,
  audience: string,
): Promise<JwtClaims> {
  return verifyJwt(token, {
    algorithms: ["HS256"],
    key: await importHmacSecret(secret),
    issuer: ISSUER,
    audience,
  });
}

export async function verifySandboxJwt(
  token: string,
  secret: string,
): Promise<{ userId: number; payload: JwtClaims }> {
  const payload = await verifySignedJwt(token, secret, ISSUER);
  const userId = toPositiveInteger(payload.sub);

  if (!userId) {
    throw new Error("JWT subject must be a positive integer user id");
  }

  return { userId, payload };
}

function previewGrantMaxAge(purpose: SandboxPreviewGrantPurpose): number {
  switch (purpose) {
    case "exposure":
      return 30;
    case "bootstrap":
      return SANDBOX_PREVIEW_BOOTSTRAP_TTL_SECONDS;
    case "session":
      return SANDBOX_PREVIEW_ACCESS_TTL_SECONDS;
  }

  throw new Error("Unsupported sandbox preview grant purpose");
}

export async function verifySandboxPreviewGrant(
  token: string,
  secret: string,
  purpose: SandboxPreviewGrantPurpose,
): Promise<SandboxPreviewGrantClaims> {
  const payload = await verifySignedJwt(token, secret, SANDBOX_PREVIEW_GRANT_AUDIENCE);
  const parsed = sandboxPreviewGrantClaimsSchema.safeParse(payload);
  const now = Math.floor(Date.now() / 1_000);

  if (
    !parsed.success ||
    parsed.data.purpose !== purpose ||
    parsed.data.iat > now + 30 ||
    now - parsed.data.iat > previewGrantMaxAge(purpose)
  ) {
    throw new Error("Sandbox preview grant is invalid");
  }

  return parsed.data;
}

export async function createInternalServiceToken(
  secret: string,
  scope: InternalServiceScope,
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);

  return signJwt(
    {
      aud: INTERNAL_SERVICE_TOKEN_AUDIENCE,
      exp: now + INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
      iat: now,
      iss: ISSUER,
      jti: crypto.randomUUID(),
      scopes: [scope],
      sub: "sandbox-worker",
    },
    { algorithm: "HS256", key: await importHmacSecret(secret) },
  );
}
