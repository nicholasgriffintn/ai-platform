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

interface JwtHeader {
  alg?: string;
  typ?: string;
}

interface JwtPayload {
  sub?: string;
  iss?: string;
  aud?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalised = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalised.length % 4)) % 4);
  const base64 = `${normalised}${padding}`;
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeJwtJson<T extends object>(segment: string): T {
  const bytes = decodeBase64Url(segment);
  const text = new TextDecoder().decode(bytes);
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JWT segment is not a valid JSON object");
  }

  return parsed as T;
}

function toPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  if (value <= 0 || !Number.isInteger(value)) {
    return null;
  }

  return value;
}

export async function verifySandboxJwt(
  token: string,
  secret: string,
): Promise<{ userId: number; payload: JwtPayload }> {
  const payload = await verifySignedJwt(token, secret, "assistant");
  const userId = toPositiveInteger(Number(payload.sub)) ?? toPositiveInteger(payload.sub);

  if (!userId) {
    throw new Error("JWT subject must be a positive integer user id");
  }

  return { userId, payload };
}

async function verifySignedJwt(
  token: string,
  secret: string,
  audience: string,
): Promise<JwtPayload> {
  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("JWT must contain three segments");
  }

  const [headerSegment, payloadSegment, signatureSegment] = parts;
  const header = decodeJwtJson<JwtHeader>(headerSegment);

  if (header.alg !== "HS256") {
    throw new Error("JWT algorithm must be HS256");
  }

  const hmacKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signedData = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`);
  const signature = decodeBase64Url(signatureSegment);
  const verified = await crypto.subtle.verify("HMAC", hmacKey, signature, signedData);

  if (!verified) {
    throw new Error("JWT signature verification failed");
  }

  const payload = decodeJwtJson<JwtPayload>(payloadSegment);
  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new Error("JWT is expired");
  }

  if (typeof payload.nbf === "number" && payload.nbf > now) {
    throw new Error("JWT is not active yet");
  }

  if (payload.iss !== "assistant") {
    throw new Error("JWT issuer is invalid");
  }

  if (payload.aud !== audience) {
    throw new Error("JWT audience is invalid");
  }

  return payload;
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
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      aud: INTERNAL_SERVICE_TOKEN_AUDIENCE,
      exp: now + INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
      iat: now,
      iss: "assistant",
      jti: crypto.randomUUID(),
      scopes: [scope],
      sub: "sandbox-worker",
    }),
  );
  const signedData = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedData));

  return `${signedData}.${encodeBase64Url(signature)}`;
}
