import * as jwt from "@tsndr/cloudflare-worker-jwt";
import { AwsClient } from "aws4fetch";
import type { Context } from "hono";

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
 * Sends a magic link email using AWS SES.
 * @param context - The context of the request
 * @param email - The user's email
 * @param magicLink - The magic link to send
 */
export async function sendMagicLinkEmail(
  context: Context,
  email: string,
  magicLink: string,
): Promise<void> {
  const { AWS_SES_ACCESS_KEY_ID, AWS_SES_SECRET_ACCESS_KEY, SES_EMAIL_FROM } =
    context.env;

  if (!AWS_SES_ACCESS_KEY_ID || !AWS_SES_SECRET_ACCESS_KEY || !SES_EMAIL_FROM) {
    throw new AssistantError(
      "AWS SES configuration missing",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const awsClient = new AwsClient({
    accessKeyId: AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: AWS_SES_SECRET_ACCESS_KEY,
    region: "us-east-1",
  });

  const subject = "Login to Polychat";
  const bodyText = `Click this link to log in: ${magicLink}`;
  const bodyHtml = `
    <html>
      <head></head>
      <body>
        <h1>Login to Your Account</h1>
        <p>Click the link below to log in:</p>
        <a href="${magicLink}">Log In</a>
        <p>If you didn\'t request this link, you can safely ignore this email.</p>
        <p>This link will expire in ${MAGIC_LINK_EXPIRATION_MINUTES} minutes.</p>
      </body>
    </html>
  `;

  const requestBody = JSON.stringify({
    FromEmailAddress: SES_EMAIL_FROM,
    Destination: {
      ToAddresses: [email],
    },
    Content: {
      Simple: {
        Subject: {
          Data: subject,
          Charset: "UTF-8",
        },
        Body: {
          Text: {
            Data: bodyText,
            Charset: "UTF-8",
          },
          Html: {
            Data: bodyHtml,
            Charset: "UTF-8",
          },
        },
      },
    },
  });

  const contentLength = new TextEncoder().encode(requestBody).length;

  const request = new Request(
    "https://email.us-east-1.amazonaws.com/v2/email/outbound-emails",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": contentLength.toString(),
      },
      body: requestBody,
    },
  );

  try {
    const signedRequest = await awsClient.sign(request);
    const response = await fetch(signedRequest);

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error("SES error response:", errorBody);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
    logger.info(`Magic link email sent to ${email}`);
  } catch (error: any) {
    logger.error("Failed to send magic link email:", { error });
    throw new AssistantError(
      `Failed to send magic link: ${error.message}`,
      ErrorType.EMAIL_SEND_FAILED,
    );
  }
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
