import * as jwt from "@tsndr/cloudflare-worker-jwt";
import { AwsClient } from "aws4fetch";
import type { Context } from "hono";

import { AssistantError, ErrorType } from "../../utils/errors";

const MAGIC_LINK_EXPIRATION_MINUTES = 15;

interface MagicLinkPayload {
  userId: string;
  email: string;
  exp: number;
  iat: number;
}

/**
 * Generates a short-lived magic link token.
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
 */
async function sendMagicLinkEmail(
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
  // Simple HTML body
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
      console.error("SES error response:", errorBody);
      throw new Error(`Failed to send email: ${response.statusText}`);
    }
    console.log(`Magic link email sent to ${email}`);
  } catch (error: any) {
    console.error("Failed to send magic link email:", error);
    throw new AssistantError(
      `Failed to send magic link: ${error.message}`,
      ErrorType.EMAIL_SEND_FAILED,
    );
  }
}

/**
 * Verifies a magic link token and returns the user ID.
 */
async function verifyMagicLinkToken(
  token: string,
  jwtSecret: string,
): Promise<string | null> {
  try {
    const isValid = await jwt.verify(token, jwtSecret, { algorithm: "HS256" });
    if (!isValid) {
      console.log("Magic link token signature invalid");
      return null;
    }

    const { payload } = jwt.decode(token);
    const magicLinkPayload = payload as MagicLinkPayload;

    if (
      magicLinkPayload.exp &&
      magicLinkPayload.exp < Math.floor(Date.now() / 1000)
    ) {
      console.log("Magic link token expired");
      return null;
    }

    if (magicLinkPayload && typeof magicLinkPayload.userId === "string") {
      return magicLinkPayload.userId;
    }

    console.error("Invalid magic link token payload:", magicLinkPayload);
    return null;
  } catch (error: any) {
    console.error("Magic link token verification failed:", error);
    return null;
  }
}

export { generateMagicLinkToken, sendMagicLinkEmail, verifyMagicLinkToken };
