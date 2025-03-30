import type { Context, Next } from "hono";

import { Database } from "../lib/database";
import { getModelConfigByModel } from "../lib/models";
import { getUserByJwtToken } from "../services/auth/jwt";
import { getUserBySessionId } from "../services/auth/user";
import type { User } from "../types";
import { AssistantError, ErrorType } from "../utils/errors";

/**
 * Authentication middleware that supports session-based, token-based, and JWT auth
 */
export async function authMiddleware(context: Context, next: Next) {
  const hasLegacyToken = !!context.env.ACCESS_TOKEN;
  const hasJwtSecret = !!context.env.JWT_SECRET;

  let isRestricted = true;
  let user: User | null = null;

  const authFromQuery = context.req.query("token");
  const authFromHeaders = context.req.header("Authorization");
  const authToken = authFromQuery || authFromHeaders?.split("Bearer ")[1];

  const cookies = context.req.header("Cookie") || "";
  const sessionMatch = cookies.match(/session=([^;]+)/);
  const sessionId = sessionMatch ? sessionMatch[1] : null;

  const isJwtToken = authToken?.split(".").length === 3;

  if (sessionId) {
    const database = Database.getInstance(context.env);

    user = await getUserBySessionId(database, sessionId);

    if (user) {
      isRestricted = false;
    }
  } else if (isJwtToken && hasJwtSecret) {
    try {
      user = await getUserByJwtToken(
        context.env.DB,
        authToken,
        context.env.JWT_SECRET!,
      );

      const isProPlan = user?.plan_id === "pro";

      if (user && isProPlan) {
        isRestricted = false;
      }
    } catch (error) {
      console.error("JWT authentication failed:", error);
    }
  } else if (hasLegacyToken && authToken === context.env.ACCESS_TOKEN) {
    isRestricted = false;
  }

  context.set("user", user);
  context.set("isRestricted", isRestricted);

  return next();
}

/**
 * Middleware that requires full authentication (no restricted access)
 */
export async function requireAuth(context: Context, next: Next) {
  const isRestricted = context.get("isRestricted");

  if (isRestricted) {
    throw new AssistantError(
      "This endpoint requires authentication. Please provide a valid access token.",
      ErrorType.AUTHENTICATION_ERROR,
    );
  }

  await next();
}

/**
 * Middleware that allows restricted access to certain paths with model validation
 */
export async function allowRestrictedPaths(context: Context, next: Next) {
  const isRestricted = context.get("isRestricted");

  if (isRestricted) {
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
        const modelInfo = getModelConfigByModel(body?.model);

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

        if (!modelInfo || !modelInfo.isFree) {
          throw new AssistantError(
            "In restricted mode, you must specify one of the free models (these mostly include Mistral and Workers AI provided models).",
            ErrorType.AUTHENTICATION_ERROR,
          );
        }

        context.set("parsedBody", body);
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
