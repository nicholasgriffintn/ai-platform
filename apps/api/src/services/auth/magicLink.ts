import * as jwt from "@tsndr/cloudflare-worker-jwt";

import { MAGIC_LINK_EXPIRATION_MINUTES } from "~/constants/app";
import { Database } from "~/lib/database";
import type { IEnv } from "~/types";
import type { User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "MAGIC_LINK" });

interface MagicLinkPayload {
  userId: string;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Generates a short-lived magic link token.
 * @param userId - The user ID
 * @param email - The user's email
 * @param jwtSecret - The JWT secret
 * @returns The generated token and nonce
 */
async function generateMagicLinkToken(
  userId: string,
  email: string,
  jwtSecret: string,
): Promise<{ token: string; nonce: string }> {
  const expirationTime =
    Math.floor(Date.now() / 1000) + MAGIC_LINK_EXPIRATION_MINUTES * 60;

  const payload = {
    userId,
    email,
    exp: expirationTime,
    iat: Math.floor(Date.now() / 1000),
  };

  const token = await jwt.sign(payload, jwtSecret, { algorithm: "HS256" });

  const nonce = crypto.randomUUID();

  return { token, nonce };
}

/**
 * Verifies a magic link token and returns the user ID.
 * @param token - The magic link token
 * @param jwtSecret - The JWT secret
 * @returns The user ID or null if the token is invalid or expired
 */
async function verifyMagicLinkToken(
  token: string,
  jwtSecret: string,
): Promise<string | null> {
  try {
    const isValid = await jwt.verify(token, jwtSecret, { algorithm: "HS256" });
    if (!isValid) {
      logger.info("Magic link token signature invalid");
      return null;
    }

    const { payload } = jwt.decode(token);
    const magicLinkPayload = payload as MagicLinkPayload;

    if (
      magicLinkPayload.exp &&
      magicLinkPayload.exp < Math.floor(Date.now() / 1000)
    ) {
      logger.info("Magic link token expired");
      return null;
    }

    if (magicLinkPayload && typeof magicLinkPayload.userId === "string") {
      return magicLinkPayload.userId;
    }

    logger.error("Invalid magic link token payload:", magicLinkPayload);
    return null;
  } catch (error: any) {
    logger.error("Magic link token verification failed:", { error });
    return null;
  }
}

/**
 * Request a magic login link: generate token and nonce, persist nonce.
 * Returns the token and nonce for email dispatch.
 */
export async function requestMagicLink(
  env: IEnv,
  email: string,
): Promise<{ token: string; nonce: string }> {
  const secret = env.EMAIL_JWT_SECRET;
  if (!secret) {
    throw new AssistantError(
      "JWT secret not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const db = Database.getInstance(env);
  const user = (await db.getUserByEmail(email)) as User | null;

  let newUser = user;
  if (!user) {
    try {
      newUser = (await db.createUser({ email })) as unknown as User;

      if (!newUser) {
        throw new AssistantError(
          "Failed to create user",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }
    } catch {
      return { token: "", nonce: "" };
    }
  }

  const { token, nonce } = await generateMagicLinkToken(
    newUser.id.toString(),
    email,
    secret,
  );

  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_EXPIRATION_MINUTES * 60 * 1000,
  );
  await db.createMagicLinkNonce(nonce, newUser.id, expiresAt);

  return { token, nonce };
}

/**
 * Verify magic link: validate token and consume nonce. Returns userId.
 */
export async function verifyMagicLink(
  env: IEnv,
  token: string,
  nonce: string,
): Promise<number> {
  const secret = env.EMAIL_JWT_SECRET;
  if (!secret) {
    throw new AssistantError(
      "JWT secret not configured",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const db = Database.getInstance(env);
  const userIdString = await verifyMagicLinkToken(token, secret);

  if (!userIdString) {
    throw new AssistantError(
      "Invalid or expired token/nonce",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const userId = Number.parseInt(userIdString, 10);
  if (Number.isNaN(userId)) {
    logger.error(`Invalid userId parsed from token: ${userIdString}`);
    throw new AssistantError(
      "Invalid user identifier in token",
      ErrorType.INTERNAL_ERROR,
    );
  }

  const consumed = await db.consumeMagicLinkNonce(nonce, userId);

  if (!consumed) {
    throw new AssistantError(
      "Invalid or expired token/nonce",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  const user = await db.getUserById(userId);

  if (!user) {
    throw new AssistantError(
      "User not found for valid token",
      ErrorType.INTERNAL_ERROR,
    );
  }

  return userId;
}
