import jwt from "@tsndr/cloudflare-worker-jwt";

import { RepositoryManager } from "~/repositories";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { getUserById } from "./user";

const logger = getLogger({ prefix: "services/auth/jwt" });

type JwtData = {
	header: {
		typ: string;
		alg: string;
	};
	payload: { [key: string]: any };
};

const DEFAULT_EXPIRATION = 60 * 15; // 15 minutes in seconds

/**
 * Generate a JWT token for a user
 * @param user - The user to generate the token for
 * @param secret - The secret key to use for the token
 * @param expiresIn - The expiration time in seconds
 * @returns The generated JWT token
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
		logger.error("Error generating JWT token:", { error });
		throw new AssistantError(
			"Failed to generate authentication token",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}

/**
 * Verify a JWT token and return the decoded payload
 * @param token - The JWT token to verify
 * @param secret - The secret key to use for the token
 * @returns The decoded JWT payload
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
		logger.error("Error verifying JWT token:", { error });
		throw new AssistantError(
			"Invalid or expired authentication token",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}
}

/**
 * Get a user by their JWT token
 * @param env - The environment variables
 * @param token - The JWT token to get the user from
 * @param secret - The secret key to use for the token
 * @returns The user or null if the token is invalid or expired
 */
export async function getUserByJwtToken(
	env: IEnv,
	token: string,
	secret: string,
): Promise<User | null> {
	try {
		const decoded = await verifyJwtToken(token, secret);
		const userId = Number.parseInt(decoded.payload.sub, 10);

		const repositories = new RepositoryManager(env);
		return await getUserById(repositories, userId);
	} catch (error) {
		if (error instanceof AssistantError) {
			throw error;
		}

		logger.error("Error getting user by JWT token:", { error });
		throw new AssistantError(
			"Failed to retrieve user from token",
			ErrorType.UNKNOWN_ERROR,
		);
	}
}
