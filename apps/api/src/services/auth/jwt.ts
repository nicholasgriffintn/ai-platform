import { importHmacSecret, signJwt, verifyJwt, type JwtClaims } from "@ngriffin_uk/auth-jwt";

import { RepositoryManager } from "~/repositories";
import { getUserById } from "~/services/auth/user";
import type { IEnv, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "services/auth/jwt" });
const DEFAULT_EXPIRATION = 15 * 60;

export async function generateJwtToken(
	user: User,
	secret: string,
	expiresIn = DEFAULT_EXPIRATION,
): Promise<string> {
	try {
		const now = Math.floor(Date.now() / 1_000);
		const key = await importHmacSecret(secret);
		return signJwt(
			{
				sub: String(user.id),
				email: user.email,
				name: user.name,
				iss: "assistant",
				aud: "assistant",
				iat: now,
				exp: now + expiresIn,
			},
			{ algorithm: "HS256", key },
		);
	} catch (cause) {
		logger.error("Error generating JWT token:", { error: cause });
		throw new AssistantError(
			"Failed to generate authentication token",
			ErrorType.UNKNOWN_ERROR,
			500,
			{ cause },
		);
	}
}

export async function verifyJwtToken(token: string, secret: string): Promise<JwtClaims> {
	try {
		return await verifyJwt(token, {
			algorithms: ["HS256"],
			key: await importHmacSecret(secret),
			issuer: "assistant",
			audience: "assistant",
		});
	} catch (cause) {
		throw new AssistantError(
			"Invalid or expired authentication token",
			ErrorType.AUTHENTICATION_ERROR,
			401,
			{ cause },
		);
	}
}

export async function getUserByJwtToken(
	env: IEnv,
	token: string,
	secret: string,
): Promise<User | null> {
	try {
		const claims = await verifyJwtToken(token, secret);
		if (typeof claims.sub !== "string") {
			throw new AssistantError(
				"Invalid authentication token subject",
				ErrorType.AUTHENTICATION_ERROR,
				401,
			);
		}
		const userId = Number(claims.sub);
		if (!Number.isSafeInteger(userId)) {
			throw new AssistantError(
				"Invalid authentication token subject",
				ErrorType.AUTHENTICATION_ERROR,
				401,
			);
		}
		return getUserById(new RepositoryManager(env), userId);
	} catch (cause) {
		if (cause instanceof AssistantError) throw cause;
		logger.error("Error getting user by JWT token:", { error: cause });
		throw new AssistantError("Failed to retrieve user from token", ErrorType.UNKNOWN_ERROR, 500, {
			cause,
		});
	}
}
