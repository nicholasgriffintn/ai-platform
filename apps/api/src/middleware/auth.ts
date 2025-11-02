import type { Context, Next } from "hono";
import { isbot } from "isbot";

import { KVCache } from "~/lib/cache";
import { Database } from "~/lib/database";
import { getUserByJwtToken } from "~/services/auth/jwt";
import { getUserBySessionId } from "~/services/auth/user";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "middleware/auth" });

const ANONYMOUS_ID_COOKIE = "anon_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const BOT_CACHE_TTL = 86400; // 24 hours - bot detection is very stable

let botCache: KVCache | null = null;

function getBotCache(kv: any): KVCache | null {
	if (!kv) {
		return null;
	}
	if (!botCache) {
		botCache = new KVCache(kv, BOT_CACHE_TTL);
	}
	return botCache;
}

async function isBotCached(userAgent: string, kv: any): Promise<boolean> {
	const cache = getBotCache(kv);
	if (!cache) {
		try {
			return isbot(userAgent);
		} catch (error) {
			logger.error("Failed to check if user is a bot:", { error });
			return true;
		}
	}

	const cacheKey = KVCache.createKey("bot", userAgent);

	const cached = await cache.get<boolean>(cacheKey);
	if (cached !== null) {
		return cached;
	}

	let isBotUser: boolean;
	try {
		isBotUser = isbot(userAgent);
	} catch (error) {
		logger.error("Failed to check if user is a bot:", { error });
		isBotUser = true;
	}

	cache.set(cacheKey, isBotUser).catch((error) => {
		logger.error("Failed to cache bot detection result", { error, userAgent });
	});

	return isBotUser;
}

function parseCookies(cookieHeader: string): Record<string, string> {
	const cookies: Record<string, string> = {};
	if (!cookieHeader) return cookies;

	for (const cookie of cookieHeader.split(";")) {
		const [name, ...rest] = cookie.trim().split("=");
		if (name && rest.length > 0) {
			cookies[name] = rest.join("=");
		}
	}

	return cookies;
}

/**
 * Authentication middleware that supports session-based, token-based, and JWT auth
 * Also handles anonymous user tracking for unauthenticated requests
 * @param context - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export async function authMiddleware(context: Context, next: Next) {
	const ipAddress =
		context.req.header("CF-Connecting-IP") ||
		context.req.header("X-Forwarded-For") ||
		context.req.header("X-Real-IP") ||
		"unknown";

	const userAgent = context.req.header("user-agent") || "unknown";

	const isBot = await isBotCached(userAgent, context.env.CACHE);

	if (userAgent === "unknown" || isBot) {
		return next();
	}

	const hasJwtSecret = !!context.env.JWT_SECRET;
	let user: User | null = null;
	let anonymousUser: AnonymousUser | null = null;

	const authFromQuery = context.req.query("token");
	const authFromHeaders = context.req.header("Authorization");
	const authToken = authFromQuery || authFromHeaders?.split("Bearer ")[1];

	const cookies = parseCookies(context.req.header("Cookie") || "");
	const sessionId = cookies.session;
	const anonymousId = cookies[ANONYMOUS_ID_COOKIE];

	const isJwtToken = authToken?.split(".").length === 3;
	const database = Database.getInstance(context.env);

	const authPromises: Promise<User | null>[] = [];

	if (sessionId) {
		authPromises.push(getUserBySessionId(database, sessionId));
	}

	if (authToken?.startsWith("ak_")) {
		authPromises.push(
			(async () => {
				try {
					const userId = await database.findUserIdByApiKey(authToken);
					if (userId) {
						const foundUser = await database.getUserById(userId);
						return foundUser || null;
					}
					return null;
				} catch (error) {
					logger.error("API Key authentication check failed:", { error });
					return null;
				}
			})(),
		);
	}

	if (isJwtToken && hasJwtSecret) {
		authPromises.push(
			(async () => {
				try {
					return await getUserByJwtToken(
						context.env,
						authToken!,
						context.env.JWT_SECRET!,
					);
				} catch (error) {
					logger.error("JWT authentication failed:", { error });
					return null;
				}
			})(),
		);
	}

	if (authPromises.length > 0) {
		const authResults = await Promise.allSettled(authPromises);
		const fulfilledResult = authResults.find(
			(result) => result.status === "fulfilled" && result.value !== null,
		);
		user =
			fulfilledResult?.status === "fulfilled" ? fulfilledResult.value : null;
	}

	if (!user) {
		try {
			if (anonymousId) {
				anonymousUser = await database.getAnonymousUserById(anonymousId);
			}

			if (!anonymousUser) {
				anonymousUser = await database.getOrCreateAnonymousUser(
					ipAddress,
					userAgent,
				);

				if (anonymousUser) {
					context.header(
						"Set-Cookie",
						`${ANONYMOUS_ID_COOKIE}=${anonymousUser.id}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`,
					);
				}
			}
		} catch (error) {
			logger.error("Anonymous user tracking failed:", { error });
		}
	}

	context.set("user", user);
	context.set("anonymousUser", anonymousUser);

	return next();
}

/**
 * Middleware that requires authentication
 * @param context - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export async function requireAuth(context: Context, next: Next) {
	const user = context.get("user");
	const anonymousUser = context.get("anonymousUser");

	if (!user?.id && !anonymousUser?.id) {
		throw new AssistantError(
			"This endpoint requires authentication. Please provide a valid access token.",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	await next();
}

/**
 * Middleware that allows restricted access to certain paths with model validation
 * @param context - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export async function allowRestrictedPaths(context: Context, next: Next) {
	const user = context.get("user");
	const isProUser = user?.plan_id === "pro";

	if (!isProUser) {
		const anonymousUser = context.get("anonymousUser");

		if (!user && !anonymousUser) {
			logger.warn(
				"Missing user or anonymous user data for restricted path access",
			);
			throw new AssistantError(
				"User usage tracking required for this endpoint.",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}

		const path = context.req.path;
		const method = context.req.method;

		const isGenerateTitlePath =
			/^\/chat\/completions\/[^/]+\/generate-title$/.test(path) &&
			method === "POST";
		const isUpdatePath =
			/^\/chat\/completions\/[^/]+$/.test(path) && method === "PUT";
		const isDeletePath =
			/^\/chat\/completions\/[^/]+$/.test(path) && method === "DELETE";
		const isCheckPath =
			/^\/chat\/completions\/[^/]+\/check$/.test(path) && method === "POST";
		const isFeedbackPath =
			/^\/chat\/completions\/[^/]+\/feedback$/.test(path) && method === "POST";
		const isSharePath =
			/^\/chat\/completions\/[^/]+\/share$/.test(path) && method === "POST";
		const isUnsharePath =
			/^\/chat\/completions\/[^/]+\/unshare$/.test(path) && method === "POST";
		const isGetSharedPath =
			/^\/chat\/shared\/[^/]+$/.test(path) && method === "GET";

		const isAllowedPath =
			isGenerateTitlePath ||
			isUpdatePath ||
			isDeletePath ||
			isCheckPath ||
			isFeedbackPath ||
			isSharePath ||
			isUnsharePath ||
			isGetSharedPath;

		if (path === "/chat/completions" && method === "POST") {
			try {
				const body = await context.req.json();

				if (body?.use_rag) {
					throw new AssistantError(
						"RAG features require authentication. Please provide a valid access token.",
						ErrorType.AUTHENTICATION_ERROR,
					);
				}

				if (body?.tools?.length > 0 || body?.tool_choice) {
					throw new AssistantError(
						"Tool usage requires authentication. Please provide a valid access token.",
						ErrorType.AUTHENTICATION_ERROR,
					);
				}
			} catch (error) {
				if (error instanceof AssistantError) {
					throw error;
				}
			}
		} else if (!isAllowedPath) {
			throw new AssistantError(
				"This endpoint requires authentication. Please provide a valid access token.",
				ErrorType.AUTHENTICATION_ERROR,
			);
		}
	}

	await next();
}
