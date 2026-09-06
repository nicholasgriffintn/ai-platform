import { hashSecret } from "@ngriffin_uk/auth-core";
import { importHmacSecret, signJwt, verifyJwt, type JwtClaims } from "@ngriffin_uk/auth-jwt";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { generateJwtToken } from "~/services/auth/jwt";
import { createAssistantAuth } from "~/services/auth/sharedAuth";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/auth/sessions" });

const NATIVE_AUTH_CODE_EXPIRES_IN_SECONDS = 120;
const NATIVE_AUTH_CODE_CLOCK_TOLERANCE_SECONDS = 30;
const NATIVE_AUTH_CODE_PURPOSE = "native_auth_exchange";

interface NativeAuthCodePayload extends JwtClaims {
  purpose: typeof NATIVE_AUTH_CODE_PURPOSE;
  jti: string;
  sub: string;
  session_id: string;
  iss: "assistant";
  aud: "assistant-native";
  iat: number;
  exp: number;
}

export interface SessionWithJwt {
  jwt_token: string | null;
  jwt_expires_at: string | null;
}

export async function handleLogout({
  context,
  env,
  sessionId,
  userId,
  notificationInstallationId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  sessionId: string | null;
  userId?: number;
  notificationInstallationId?: string | null;
}): Promise<{ success: boolean }> {
  const serviceContext = resolveServiceContext({ context, env });

  if (userId && notificationInstallationId) {
    await serviceContext.repositories.taskNotifications.removeRegistration(
      userId,
      notificationInstallationId,
    );
  }

  if (sessionId) {
    await createAssistantAuth(serviceContext).revokeSession(sessionId);
  }

  return { success: true };
}

export async function generateUserToken({
  context,
  env,
  user,
  sessionId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: IUser;
  sessionId?: string | null;
}): Promise<{ token: string; expires_in: number }> {
  const serviceContext = resolveServiceContext({ context, env, user });

  if (!serviceContext.env.JWT_SECRET) {
    throw new AssistantError("JWT authentication not configured", ErrorType.CONFIGURATION_ERROR);
  }

  if (sessionId) {
    const sessionTokenHash = await hashSecret(sessionId);
    const sessionData =
      await serviceContext.repositories.sessions.getSessionWithJwt(sessionTokenHash);

    if (sessionData?.jwt_token && sessionData?.jwt_expires_at) {
      const jwtExpiresAt = new Date(sessionData.jwt_expires_at);
      const now = new Date();
      const minutesRemaining = Math.floor((jwtExpiresAt.getTime() - now.getTime()) / (1000 * 60));

      if (minutesRemaining > 5) {
        const expiresIn = Math.floor((jwtExpiresAt.getTime() - now.getTime()) / 1000);

        return {
          token: sessionData.jwt_token,
          expires_in: expiresIn,
        };
      }
    }

    const expiresIn = 60 * 15; // 15 minutes in seconds
    const token = await generateJwtToken(user, serviceContext.env.JWT_SECRET, expiresIn);
    const jwtExpiresAt = new Date(Date.now() + expiresIn * 1000);

    await serviceContext.repositories.sessions.updateSessionJwt(
      sessionTokenHash,
      token,
      jwtExpiresAt,
    );

    return {
      token,
      expires_in: expiresIn,
    };
  }

  const expiresIn = 60 * 15; // 15 minutes in seconds
  const token = await generateJwtToken(user, serviceContext.env.JWT_SECRET, expiresIn);

  return {
    token,
    expires_in: expiresIn,
  };
}

export async function generateNativeAuthExchangeCode({
  context,
  env,
  userId,
  sessionId,
}: {
  context?: ServiceContext;
  env?: IEnv;
  userId: number | string;
  sessionId: string;
}): Promise<{ code: string; expires_in: number }> {
  const serviceContext = resolveServiceContext({ context, env });

  if (!serviceContext.env.JWT_SECRET) {
    throw new AssistantError("JWT authentication not configured", ErrorType.CONFIGURATION_ERROR);
  }

  const now = Math.floor(Date.now() / 1000);
  const payload: NativeAuthCodePayload = {
    purpose: NATIVE_AUTH_CODE_PURPOSE,
    jti: generateId(),
    sub: userId.toString(),
    session_id: sessionId,
    iss: "assistant",
    aud: "assistant-native",
    iat: now,
    exp: now + NATIVE_AUTH_CODE_EXPIRES_IN_SECONDS,
  };

  const code = await signJwt(payload, {
    algorithm: "HS256",
    key: await importHmacSecret(serviceContext.env.JWT_SECRET),
  });

  return {
    code,
    expires_in: NATIVE_AUTH_CODE_EXPIRES_IN_SECONDS,
  };
}

export async function exchangeNativeAuthCode({
  context,
  env,
  code,
}: {
  context?: ServiceContext;
  env?: IEnv;
  code: string;
}): Promise<{ token: string; expires_in: number; sessionId: string }> {
  const serviceContext = resolveServiceContext({ context, env });

  if (!serviceContext.env.JWT_SECRET) {
    throw new AssistantError("JWT authentication not configured", ErrorType.CONFIGURATION_ERROR);
  }

  let payload;

  try {
    payload = await verifyJwt(code, {
      algorithms: ["HS256"],
      key: await importHmacSecret(serviceContext.env.JWT_SECRET),
      issuer: "assistant",
      audience: "assistant-native",
      maxTokenAgeSeconds: NATIVE_AUTH_CODE_EXPIRES_IN_SECONDS,
      clockToleranceSeconds: NATIVE_AUTH_CODE_CLOCK_TOLERANCE_SECONDS,
    });
  } catch (cause) {
    logger.warn("native sign-in code rejected", { reason: "signature" });

    throw new AssistantError(
      "Invalid or expired sign-in code",
      ErrorType.AUTHENTICATION_ERROR,
      401,
      { cause },
    );
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    payload["purpose"] !== NATIVE_AUTH_CODE_PURPOSE ||
    payload.iss !== "assistant" ||
    payload.aud !== "assistant-native" ||
    typeof payload.jti !== "string" ||
    !payload.sub ||
    typeof payload["session_id"] !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < now
  ) {
    logger.warn("native sign-in code rejected", { reason: "claims" });

    throw new AssistantError(
      "Invalid or expired sign-in code",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const userId = Number.parseInt(payload.sub, 10);

  if (Number.isNaN(userId)) {
    throw new AssistantError("Invalid sign-in user", ErrorType.AUTHENTICATION_ERROR, 401);
  }

  const sessionId = payload["session_id"];
  const sessionTokenHash = await hashSecret(sessionId);
  const session = await serviceContext.repositories.sessions.getSessionWithJwt(sessionTokenHash);

  if (!session || session.user_id !== userId) {
    logger.warn("native sign-in code rejected", {
      reason: session ? "session-owner" : "session-missing",
    });

    throw new AssistantError(
      "Invalid or expired sign-in session",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const consumed = await serviceContext.repositories.sessions.consumeNativeAuthCode({
    jti: payload.jti,
    sessionId: sessionTokenHash,
    userId,
    expiresAt: new Date(payload.exp * 1000),
  });

  if (!consumed) {
    logger.warn("native sign-in code rejected", { reason: "already-used" });

    throw new AssistantError(
      "Invalid or expired sign-in code",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const user = (await serviceContext.repositories.users.getUserById(userId)) as IUser | null;

  if (!user) {
    logger.warn("native sign-in code rejected", { reason: "user-missing" });

    throw new AssistantError(
      "User not found for this sign-in code",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  const token = await generateUserToken({
    context: serviceContext,
    user,
    sessionId,
  });

  return {
    ...token,
    sessionId,
  };
}

export function extractSessionIdFromCookies(cookies: string): string | null {
  const sessionMatch = cookies.match(/session=([^;]+)/);

  return sessionMatch ? sessionMatch[1] : null;
}

export function createLogoutCookie(): string {
  return "session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0";
}

export function createSessionCookie(sessionId: string): string {
  return `session=${sessionId}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=604800`;
}
