import jwt from "@tsndr/cloudflare-worker-jwt";

import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import { generateJwtToken } from "~/services/auth/jwt";
import type { IEnv, IUser } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

const MOBILE_AUTH_CODE_EXPIRES_IN_SECONDS = 60;
const MOBILE_AUTH_CODE_PURPOSE = "mobile_auth_exchange";

interface MobileAuthCodePayload {
	purpose: typeof MOBILE_AUTH_CODE_PURPOSE;
	jti: string;
	sub: string;
	session_id: string;
	iss: "assistant";
	aud: "assistant-mobile";
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
		throw new AssistantError("JWT authentication not configured", ErrorType.CONFIGURATION_ERROR);
	}

	if (sessionId) {
		const sessionData = await serviceContext.repositories.sessions.getSessionWithJwt(sessionId);

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

		await serviceContext.repositories.sessions.updateSessionJwt(sessionId, token, jwtExpiresAt);

		return {
			token,
			expires_in: expiresIn,
		};
	} else {
		const expiresIn = 60 * 15; // 15 minutes in seconds
		const token = await generateJwtToken(user, serviceContext.env.JWT_SECRET, expiresIn);

		return {
			token,
			expires_in: expiresIn,
		};
	}
}

export async function generateMobileAuthExchangeCode({
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
	const payload: MobileAuthCodePayload = {
		purpose: MOBILE_AUTH_CODE_PURPOSE,
		jti: generateId(),
		sub: userId.toString(),
		session_id: sessionId,
		iss: "assistant",
		aud: "assistant-mobile",
		iat: now,
		exp: now + MOBILE_AUTH_CODE_EXPIRES_IN_SECONDS,
	};

	const code = await jwt.sign(payload, serviceContext.env.JWT_SECRET, {
		algorithm: "HS256",
	});

	return {
		code,
		expires_in: MOBILE_AUTH_CODE_EXPIRES_IN_SECONDS,
	};
}

export async function exchangeMobileAuthCode({
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

	let verified: unknown;
	try {
		verified = await jwt.verify(code, serviceContext.env.JWT_SECRET, {
			algorithm: "HS256",
		});
	} catch {
		throw new AssistantError(
			"Invalid or expired mobile auth code",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	if (!verified) {
		throw new AssistantError(
			"Invalid or expired mobile auth code",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const { payload } = jwt.decode<Partial<MobileAuthCodePayload>>(code);
	const now = Math.floor(Date.now() / 1000);

	if (
		payload?.purpose !== MOBILE_AUTH_CODE_PURPOSE ||
		payload.iss !== "assistant" ||
		payload.aud !== "assistant-mobile" ||
		typeof payload.jti !== "string" ||
		!payload.sub ||
		!payload.session_id ||
		typeof payload.exp !== "number" ||
		payload.exp < now
	) {
		throw new AssistantError(
			"Invalid or expired mobile auth code",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const userId = Number.parseInt(payload.sub, 10);
	if (Number.isNaN(userId)) {
		throw new AssistantError("Invalid mobile auth user", ErrorType.AUTHENTICATION_ERROR, 401);
	}

	const session = await serviceContext.repositories.sessions.getSessionWithJwt(payload.session_id);
	if (!session || session.user_id !== userId) {
		throw new AssistantError(
			"Invalid or expired mobile session",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const consumed = await serviceContext.repositories.sessions.consumeMobileAuthCode({
		jti: payload.jti,
		sessionId: payload.session_id,
		userId,
		expiresAt: new Date(payload.exp * 1000),
	});

	if (!consumed) {
		throw new AssistantError(
			"Invalid or expired mobile auth code",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const user = (await serviceContext.repositories.users.getUserById(userId)) as IUser | null;
	if (!user) {
		throw new AssistantError(
			"User not found for mobile auth code",
			ErrorType.AUTHENTICATION_ERROR,
			401,
		);
	}

	const token = await generateUserToken({
		context: serviceContext,
		user,
		sessionId: payload.session_id,
	});

	return {
		...token,
		sessionId: payload.session_id,
	};
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
