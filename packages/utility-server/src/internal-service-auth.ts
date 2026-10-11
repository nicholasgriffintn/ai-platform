import { importHmacSecret, signJwt, verifyJwt } from "@ngriffin_uk/auth-jwt";
import {
  INTERNAL_SERVICE_DELEGATION_TOKEN_AUDIENCE,
  INTERNAL_SERVICE_DELEGATION_TOKEN_TTL_SECONDS,
  INTERNAL_SERVICE_TOKEN_AUDIENCE,
  INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
  internalServiceTokenClaimsSchema,
  type InternalServiceName,
  type InternalServiceScope,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

const ISSUER = "assistant";

async function createToken(
  secret: string,
  params: {
    service: InternalServiceName;
    scopes: InternalServiceScope[];
    userId?: number;
  },
  audience: string,
  ttlSeconds: number,
): Promise<string> {
  const normalizedSecret = secret.trim();

  if (!normalizedSecret) {
    throw new Error("Internal service authentication is not configured");
  }

  const now = Math.floor(Date.now() / 1_000);
  const claims = {
    aud: audience,
    exp: now + ttlSeconds,
    iat: now,
    iss: ISSUER,
    jti: generateId(),
    scopes: params.scopes,
    sub: params.service,
    ...(params.userId === undefined ? {} : { user_id: params.userId }),
  };

  internalServiceTokenClaimsSchema.parse(claims);

  return signJwt(claims, {
    algorithm: "HS256",
    key: await importHmacSecret(normalizedSecret),
  });
}

async function verifyToken(
  token: string,
  secret: string,
  audience: string,
  ttlSeconds: number,
): Promise<ReturnType<typeof internalServiceTokenClaimsSchema.parse>> {
  const claims = await verifyJwt(token, {
    algorithms: ["HS256"],
    audience,
    issuer: ISSUER,
    key: await importHmacSecret(secret.trim()),
    maxTokenAgeSeconds: ttlSeconds,
  });
  const parsed = internalServiceTokenClaimsSchema.safeParse(claims);

  if (!parsed.success) {
    throw new Error("Internal service token claims are invalid");
  }

  return parsed.data;
}

export function createInternalServiceToken(
  secret: string,
  params: {
    service: InternalServiceName;
    scopes: InternalServiceScope[];
    userId?: number;
  },
): Promise<string> {
  return createToken(
    secret,
    params,
    INTERNAL_SERVICE_TOKEN_AUDIENCE,
    INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
  );
}

export function createInternalServiceDelegationToken(
  secret: string,
  userId: number,
): Promise<string> {
  return createToken(
    secret,
    { service: "agent-worker", scopes: ["user:delegate"], userId },
    INTERNAL_SERVICE_DELEGATION_TOKEN_AUDIENCE,
    INTERNAL_SERVICE_DELEGATION_TOKEN_TTL_SECONDS,
  );
}

export function verifyInternalServiceJwt(
  token: string,
  secret: string,
): Promise<ReturnType<typeof internalServiceTokenClaimsSchema.parse>> {
  return verifyToken(
    token,
    secret,
    INTERNAL_SERVICE_TOKEN_AUDIENCE,
    INTERNAL_SERVICE_TOKEN_TTL_SECONDS,
  );
}

export function verifyInternalServiceDelegationJwt(
  token: string,
  secret: string,
): Promise<ReturnType<typeof internalServiceTokenClaimsSchema.parse>> {
  return verifyToken(
    token,
    secret,
    INTERNAL_SERVICE_DELEGATION_TOKEN_AUDIENCE,
    INTERNAL_SERVICE_DELEGATION_TOKEN_TTL_SECONDS,
  );
}
