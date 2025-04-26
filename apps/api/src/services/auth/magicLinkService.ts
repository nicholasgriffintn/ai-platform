import { MAGIC_LINK_EXPIRATION_MINUTES } from "~/constants/app";
import { Database } from "~/lib/database";
import type { IEnv } from "~/types";
import type { User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { generateMagicLinkToken, verifyMagicLinkToken } from "./magicLink";

const logger = getLogger({ prefix: "MAGIC_LINK_SERVICE" });

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
