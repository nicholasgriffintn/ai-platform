import type { Context, Next } from "hono";
import { parse as parseCookieHeader } from "hono/utils/cookie";
import { isbot } from "isbot";

import { KVCache } from "~/lib/cache";
import { createServiceContext } from "~/lib/context/serviceContext";
import { RepositoryManager } from "~/repositories";
import { getUserByJwtToken } from "~/services/auth/jwt";
import { createAssistantAuth } from "~/services/auth/sharedAuth";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { parseBearerToken } from "~/utils/http";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "middleware/auth" });

const ANONYMOUS_ID_COOKIE = "anon_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
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

/**
 * Authentication middleware that supports session, API-key, and JWT auth
 * Also handles anonymous user tracking for unauthenticated requests
 * @param context - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export async function authMiddleware(context: Context, next: Next) {
  const path = context.req.path;

  if (path === "/status" || path === "/openapi" || path.startsWith("/webhooks/")) {
    return next();
  }

  const ipAddress =
    context.req.header("CF-Connecting-IP") ||
    context.req.header("X-Forwarded-For") ||
    context.req.header("X-Real-IP") ||
    "unknown";

  const userAgent = context.req.header("user-agent") || "unknown";

  const jwtSecret = context.env.JWT_SECRET;
  let repositories: RepositoryManager | null = null;
  const getRepositories = () => {
    if (!repositories) {
      repositories = new RepositoryManager(context.env);
    }

    return repositories;
  };

  let user: User | null = null;
  let anonymousUser: AnonymousUser | null = null;

  const authToken = parseBearerToken(context.req.header("Authorization"));

  const isJwtToken = authToken?.split(".").length === 3;

  const authPromises: Promise<User | null>[] = [];

  const cookies = parseCookieHeader(context.req.header("Cookie") || "");
  const sessionId = cookies.session;

  if (sessionId) {
    const authenticationContext = createServiceContext({
      env: context.env,
      requestId: context.get("requestId"),
    });

    authPromises.push(
      createAssistantAuth(authenticationContext)
        .authenticate(sessionId)
        .then((session) => session?.user.record ?? null),
    );
  }

  if (authToken?.startsWith("ak_")) {
    authPromises.push(
      (async () => {
        try {
          const repo = getRepositories();
          const userId = await repo.apiKeys.findUserIdByApiKey(authToken);

          if (userId) {
            return repo.users.getUserById(userId);
          }

          return null;
        } catch (error) {
          logger.error("API Key authentication check failed:", { error });

          return null;
        }
      })(),
    );
  }

  if (authToken && isJwtToken && jwtSecret) {
    authPromises.push(
      (async () => {
        try {
          return await getUserByJwtToken(context.env, authToken, jwtSecret);
        } catch (error) {
          if (error instanceof AssistantError && error.type === ErrorType.AUTHENTICATION_ERROR) {
            return null;
          }

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

    user = fulfilledResult?.status === "fulfilled" ? fulfilledResult.value : null;
  }

  const isProUser = user?.plan_id === "pro";

  if (userAgent === "unknown") {
    throw new AssistantError("Bot access is not allowed.", ErrorType.AUTHENTICATION_ERROR);
  }

  let isBot = false;
  const shouldSkipBotCheck = Boolean(user);

  if (!shouldSkipBotCheck) {
    isBot = await isBotCached(userAgent, context.env.CACHE);
  }

  if (isBot && !isProUser) {
    throw new AssistantError("Bot access is not allowed.", ErrorType.AUTHENTICATION_ERROR);
  }

  if (!user) {
    try {
      const anonymousId = cookies[ANONYMOUS_ID_COOKIE];

      if (anonymousId) {
        anonymousUser = await getRepositories().anonymousUsers.getAnonymousUserById(anonymousId);
      }

      if (!anonymousUser) {
        anonymousUser = await getRepositories().anonymousUsers.getOrCreateAnonymousUser(
          ipAddress,
          userAgent,
        );

        if (anonymousUser) {
          const anonymousCookie = [
            `${ANONYMOUS_ID_COOKIE}=${anonymousUser.id}`,
            "Path=/",
            `Max-Age=${COOKIE_MAX_AGE}`,
            "SameSite=Lax",
            "HttpOnly",
            "Secure",
          ].join("; ");

          context.header("Set-Cookie", anonymousCookie);
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
      logger.warn("Missing user or anonymous user data for restricted path access");
      throw new AssistantError(
        "User usage tracking required for this endpoint.",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const path = context.req.path;
    const method = context.req.method;

    const isGenerateTitlePath =
      /^\/chat\/completions\/[^/]+\/generate-title$/.test(path) && method === "POST";
    const isUpdatePath = /^\/chat\/completions\/[^/]+$/.test(path) && method === "PUT";
    const isDeletePath = /^\/chat\/completions\/[^/]+$/.test(path) && method === "DELETE";
    const isCheckPath = /^\/chat\/completions\/[^/]+\/check$/.test(path) && method === "POST";
    const isFeedbackPath = /^\/chat\/completions\/[^/]+\/feedback$/.test(path) && method === "POST";
    const isSharePath = /^\/chat\/completions\/[^/]+\/share$/.test(path) && method === "POST";
    const isUnsharePath = /^\/chat\/completions\/[^/]+\/share$/.test(path) && method === "DELETE";
    const isGetSharedPath = /^\/chat\/shared\/[^/]+$/.test(path) && method === "GET";
    const isGoalPath = /^\/chat\/completions\/[^/]+\/goal$/.test(path);

    const isAllowedPath =
      isGoalPath ||
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

        if (
          body?.tools?.length > 0 ||
          body?.tool_choice ||
          body?.enabled_tools?.length > 0 ||
          body?.approved_tools?.length > 0
        ) {
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
