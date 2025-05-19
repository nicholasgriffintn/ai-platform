import type { Context, Next } from "hono";
import { isbot } from "isbot";

import { Database } from "~/lib/database";
import { getUserByJwtToken } from "~/services/auth/jwt";
import { getUserBySessionId } from "~/services/auth/user";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "AUTH_MIDDLEWARE" });

const ANONYMOUS_ID_COOKIE = "anon_id";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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

  let isBotUser = false;

  if (userAgent === "unknown") {
    isBotUser = true;
  } else {
    try {
      isBotUser = isbot(userAgent);
    } catch (error) {
      console.error(error);
      logger.error("Failed to check if user is a bot:", { error });
    }
  }

  const hasJwtSecret = !!context.env.JWT_SECRET;

  let user: User | null = null;
  let anonymousUser: AnonymousUser | null = null;

  const authFromQuery = context.req.query("token");
  const authFromHeaders = context.req.header("Authorization");
  const authToken = authFromQuery || authFromHeaders?.split("Bearer ")[1];

  const cookies = context.req.header("Cookie") || "";
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  const isJwtToken = authToken?.split(".").length === 3;
  const database = Database.getInstance(context.env);

  if (sessionId) {
    user = await getUserBySessionId(database, sessionId);
  } else if (authToken?.startsWith("ak_")) {
    try {
      const userId = await database.findUserIdByApiKey(authToken);
      if (userId) {
        const foundUser = await database.getUserById(userId);
        if (foundUser) {
          user = foundUser;
        }
      }
    } catch (error) {
      logger.error("API Key authentication check failed:", { error });
    }
  } else if (isJwtToken && hasJwtSecret) {
    try {
      user = await getUserByJwtToken(
        context.env,
        authToken!,
        context.env.JWT_SECRET!,
      );
    } catch (error) {
      logger.error("JWT authentication failed:", { error });
    }
  }

  if (!user) {
    try {
      if (isBotUser) {
        return next();
      }

      const anonymousIdMatch = cookies.match(
        new RegExp(`${ANONYMOUS_ID_COOKIE}=([^;]+)`),
      );
      const anonymousId = anonymousIdMatch ? anonymousIdMatch[1] : null;

      if (anonymousId) {
        anonymousUser = await database.getAnonymousUserById(anonymousId);
      }

      if (!anonymousUser) {
        anonymousUser = await database.getOrCreateAnonymousUser(
          ipAddress,
          userAgent,
        );

        if (anonymousUser && !anonymousId) {
          context.header(
            "Set-Cookie",
            `${ANONYMOUS_ID_COOKIE}=${anonymousUser.id}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`,
          );
        }
      }
    } catch (error) {
      console.error(error);
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
      /^\/chat\/completions\/[^\/]+\/generate-title$/.test(path) &&
      method === "POST";
    const isUpdatePath =
      /^\/chat\/completions\/[^\/]+$/.test(path) && method === "PUT";
    const isDeletePath =
      /^\/chat\/completions\/[^\/]+$/.test(path) && method === "DELETE";
    const isCheckPath =
      /^\/chat\/completions\/[^\/]+\/check$/.test(path) && method === "POST";
    const isFeedbackPath =
      /^\/chat\/completions\/[^\/]+\/feedback$/.test(path) && method === "POST";
    const isSharePath =
      /^\/chat\/completions\/[^\/]+\/share$/.test(path) && method === "POST";
    const isUnsharePath =
      /^\/chat\/completions\/[^\/]+\/unshare$/.test(path) && method === "POST";
    const isGetSharedPath =
      /^\/chat\/shared\/[^\/]+$/.test(path) && method === "GET";

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

/**
 * Webhook authentication middleware
 * @param context - The context of the request
 * @param next - The next middleware function
 * @returns The next middleware function
 */
export async function webhookAuth(context: Context, next: Next) {
  if (!context.env.WEBHOOK_SECRET) {
    throw new AssistantError(
      "Missing WEBHOOK_SECRET binding",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  const tokenFromQuery = context.req.query("token");

  if (tokenFromQuery !== context.env.WEBHOOK_SECRET) {
    throw new AssistantError("Unauthorized", ErrorType.AUTHENTICATION_ERROR);
  }

  await next();
}
