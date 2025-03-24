import type { D1Database } from "@cloudflare/workers-types";
import jwt from "@tsndr/cloudflare-worker-jwt";

import type { User } from "../../types";
import { AssistantError, ErrorType } from "../../utils/errors";
import { getUserById } from "./user";

type JwtData = {
  header: {
    typ: string;
    alg: string;
  };
  payload: { [key: string]: any };
};

const DEFAULT_EXPIRATION = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Generate a JWT token for a user
 */
export async function generateJwtToken(
  user: User,
  secret: string,
  expiresIn: number = DEFAULT_EXPIRATION,
): Promise<string> {
  try {
    const payload = {
      sub: user.id.toString(),
      email: user.email,
      name: user.name,
      iss: "assistant",
      aud: "assistant",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    };

    return jwt.sign(payload, secret, {
      algorithm: "HS256",
    });
  } catch (error) {
    console.error("Error generating JWT token:", error);
    throw new AssistantError(
      "Failed to generate authentication token",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}

/**
 * Verify a JWT token and return the decoded payload
 */
export async function verifyJwtToken(
  token: string,
  secret: string,
): Promise<JwtData> {
  try {
    const decoded = await jwt.verify(token, secret, {
      algorithm: "HS256",
    });
    if (!decoded) {
      throw new AssistantError(
        "Invalid or expired authentication token",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }
    return decoded as JwtData;
  } catch (error) {
    console.error("Error verifying JWT token:", error);
    throw new AssistantError(
      "Invalid or expired authentication token",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }
}

/**
 * Get a user by their JWT token
 */
export async function getUserByJwtToken(
  db: D1Database,
  token: string,
  secret: string,
): Promise<User | null> {
  try {
    const decoded = await verifyJwtToken(token, secret);
    const userId = Number.parseInt(decoded.payload.sub, 10);

    return await getUserById(db, userId);
  } catch (error) {
    if (error instanceof AssistantError) {
      throw error;
    }

    console.error("Error getting user by JWT token:", error);
    throw new AssistantError(
      "Failed to retrieve user from token",
      ErrorType.UNKNOWN_ERROR,
    );
  }
}
