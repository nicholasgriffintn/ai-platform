import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import z from "zod/v4";

import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getUserSettings } from "~/services/auth/user";
import {
  handleGitHubOAuthCallback,
  getGitHubAuthUrl,
} from "~/services/auth/github";
import {
  handleLogout,
  generateUserToken,
  extractSessionIdFromCookies,
  createLogoutCookie,
  createSessionCookie,
} from "~/services/auth/sessions";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  githubCallbackSchema,
  githubLoginSchema,
  jwtTokenResponseSchema,
  userSchema,
} from "../../schemas/auth";
import { errorResponseSchema } from "../../schemas/shared";
import authMagicLink from "./magic-link";
import authWebauthn from "./webauthn";

const logger = getLogger({ prefix: "routes/auth" });

const app = new Hono();

const routeLogger = createRouteLogger("auth");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing auth route: ${c.req.path}`);
  return next();
});

app.get(
  "/github",
  describeRoute({
    tags: ["auth"],
    summary: "Initiates GitHub OAuth flow",
    responses: {
      200: {
        description:
          "Redirects to GitHub OAuth authorization page to authenticate the user",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error, such as missing configuration",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", githubLoginSchema),
  async (c: Context) => {
    const githubAuthUrl = getGitHubAuthUrl(c.env);
    return c.redirect(githubAuthUrl);
  },
);

app.get(
  "/github/callback",
  describeRoute({
    tags: ["auth"],
    summary: "GitHub OAuth callback handler",
    responses: {
      200: {
        description:
          "Given a GitHub OAuth code, this endpoint will authenticate the user and redirect to the original URL",
        content: {
          "application/json": {
            schema: resolver(z.object({})),
          },
        },
      },
      400: {
        description: "Bad request or invalid code",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  zValidator("query", githubCallbackSchema),
  async (c: Context) => {
    const { code } = c.req.valid("query" as never) as { code: string };

    const { user, sessionId } = await handleGitHubOAuthCallback(c.env, code);

    c.header("Set-Cookie", createSessionCookie(sessionId));

    const redirectUri = `${c.env.APP_BASE_URL}/auth/callback`;
    return c.redirect(redirectUri);
  },
);

app.get(
  "/me",
  describeRoute({
    tags: ["auth"],
    summary: "Get current user info",
    responses: {
      200: {
        description: "Returns the current user's information",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                user: userSchema.nullable(),
                userSettings: z.record(z.string(), z.any()).optional(),
              }),
            ),
          },
        },
      },
      401: {
        description: "Invalid or expired session",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const user = c.get("user") as User | undefined;

    if (!user) {
      const anonymousUser = c.get("anonymousUser") as AnonymousUser | undefined;
      if (anonymousUser) {
        return c.json({ user: null, userSettings: null, anon: anonymousUser });
      }
      return c.json({ user: null, userSettings: null });
    }

    try {
      const database = Database.getInstance(c.env);
      const userSettings = await getUserSettings(database, user.id);
      return c.json({ user, userSettings });
    } catch (error) {
      logger.error(`Error fetching user settings for user ${user.id}:`, {
        error,
      });
      return c.json({ user, userSettings: null });
    }
  },
);

app.post(
  "/logout",
  describeRoute({
    tags: ["auth"],
    summary: "Logout - clear session",
    responses: {
      200: {
        description: "Clears the session and logs the user out",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const cookies = c.req.header("Cookie") || "";
    const sessionId = extractSessionIdFromCookies(cookies);

    await handleLogout(c.env, sessionId);

    c.header("Set-Cookie", createLogoutCookie());

    return c.json({
      success: true,
    });
  },
);

app.get(
  "/token",
  describeRoute({
    tags: ["auth"],
    summary: "Generate a JWT token for the authenticated user",
    responses: {
      200: {
        description: "Returns a JWT token for the authenticated user",
        content: {
          "application/json": {
            schema: resolver(jwtTokenResponseSchema),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "JWT secret not configured",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
          },
        },
      },
    },
  }),
  requireAuth,
  async (c: Context) => {
    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const cookies = c.req.header("Cookie") || "";
    const sessionId = extractSessionIdFromCookies(cookies);

    const { token, expires_in } = await generateUserToken(
      c.env,
      user,
      sessionId,
    );

    return c.json({
      token,
      expires_in: expires_in,
      token_type: "Bearer",
    });
  },
);

app.route("/webauthn", authWebauthn);

app.route("/magic-link", authMagicLink);

export default app;
