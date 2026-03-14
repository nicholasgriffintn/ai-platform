import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import { generateJwtToken } from "~/services/auth/jwt";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface SessionWithJwt {
	jwt_token: string | null;
	jwt_expires_at: string | null;
}

export async function handleLogout({
	context,
	env,
	sessionId,
}: {
	context?: ServiceContext;
	env?: IEnv;
	sessionId: string | null;
}): Promise<{ success: boolean }> {
	if (sessionId) {
		const serviceContext = resolveServiceContext({ context, env });
		await serviceContext.repositories.sessions.deleteSession(sessionId);
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
		throw new AssistantError(
			"JWT authentication not configured",
			ErrorType.CONFIGURATION_ERROR,
		);
	}

	if (sessionId) {
		const sessionData =
			await serviceContext.repositories.sessions.getSessionWithJwt(sessionId);

		if (sessionData?.jwt_token && sessionData?.jwt_expires_at) {
			const jwtExpiresAt = new Date(sessionData.jwt_expires_at);
			const now = new Date();
			const minutesRemaining = Math.floor(
				(jwtExpiresAt.getTime() - now.getTime()) / (1000 * 60),
			);

			if (minutesRemaining > 5) {
				const expiresIn = Math.floor(
					(jwtExpiresAt.getTime() - now.getTime()) / 1000,
				);
				return {
					token: sessionData.jwt_token,
					expires_in: expiresIn,
				};
			}
		}

		const expiresIn = 60 * 15; // 15 minutes in seconds
		const token = await generateJwtToken(
			user,
			serviceContext.env.JWT_SECRET,
			expiresIn,
		);
		const jwtExpiresAt = new Date(Date.now() + expiresIn * 1000);

		await serviceContext.repositories.sessions.updateSessionJwt(
			sessionId,
			token,
			jwtExpiresAt,
		);

		return {
			token,
			expires_in: expiresIn,
		};
	} else {
		const expiresIn = 60 * 15; // 15 minutes in seconds
		const token = await generateJwtToken(
			user,
			serviceContext.env.JWT_SECRET,
			expiresIn,
		);

		return {
			token,
			expires_in: expiresIn,
		};
	}
}

export function extractSessionIdFromCookies(cookies: string): string | null {
	const sessionMatch = cookies.match(/session=([^;]+)/);
	return sessionMatch ? sessionMatch[1] : null;
}

export function createLogoutCookie(): string {
	return "session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0";
}

export function createSessionCookie(sessionId: string): string {
	return `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`; // 7 days
}
