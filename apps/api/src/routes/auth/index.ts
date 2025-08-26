import { Octokit } from "@octokit/rest";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod/v4";

import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { generateJwtToken } from "~/services/auth/jwt";
import {
  createOrUpdateGithubUser,
  createSession,
  deleteSession,
  getUserSettings,
} from "~/services/auth/user";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  githubCallbackSchema,
  githubLoginSchema,
  jwtTokenResponseSchema,
  userSchema,
} from "../schemas/auth";
import { errorResponseSchema } from "../schemas/shared";
import authMagicLink from "./magic-link";
import authWebauthn from "./webauthn";

const logger = getLogger({ prefix: "AUTH_API" });

const app = new Hono();

const routeLogger = createRouteLogger("AUTH");

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
    if (!c.env.GITHUB_CLIENT_ID) {
      throw new AssistantError(
        "Missing GitHub OAuth configuration",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${c.env.GITHUB_CLIENT_ID}&scope=user:email`;
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
    try {
      const { code } = c.req.valid("query" as never) as { code: string };

      if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
        throw new AssistantError(
          "Missing GitHub OAuth configuration",
          ErrorType.CONFIGURATION_ERROR,
        );
      }

      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: c.env.GITHUB_CLIENT_ID,
            client_secret: c.env.GITHUB_CLIENT_SECRET,
            code,
          }),
        },
      );

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        scope: string;
        token_type: string;
        error?: string;
        error_description?: string;
      };

      if (tokenData.error) {
        throw new AssistantError(
          `GitHub OAuth error: ${tokenData.error_description}`,
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      const accessToken = tokenData.access_token;

      const octokit = new Octokit({
        auth: accessToken,
      });
      const { data: githubUser } = await octokit.users.getAuthenticated();

      const { data: emails } =
        await octokit.users.listEmailsForAuthenticatedUser();
      const primaryEmail =
        emails.find((email) => email.primary)?.email || emails[0]?.email;

      if (!primaryEmail) {
        throw new AssistantError(
          "Could not retrieve email from GitHub account",
          ErrorType.AUTHENTICATION_ERROR,
        );
      }

      const database = Database.getInstance(c.env);

      const user = await createOrUpdateGithubUser(database, {
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: primaryEmail,
        name: githubUser.name || undefined,
        avatar_url: githubUser.avatar_url,
        company: githubUser.company || undefined,
        location: githubUser.location || undefined,
        bio: githubUser.bio || undefined,
        twitter_username: githubUser.twitter_username || undefined,
        site: githubUser.blog || undefined,
      });

      const sessionId = await createSession(database, user.id);

      c.header(
        "Set-Cookie",
        `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
      ); // 7 days

      const redirectUri = `${c.env.APP_BASE_URL}/auth/callback`;
      return c.redirect(redirectUri);
    } catch (error: any) {
      if (error instanceof AssistantError) {
        throw error;
      }

      throw new AssistantError(
        `GitHub authentication failed: ${error.message}`,
        ErrorType.AUTHENTICATION_ERROR,
      );
    }
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
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (sessionId) {
      const database = Database.getInstance(c.env);

      await deleteSession(database, sessionId);

      c.header(
        "Set-Cookie",
        "session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0",
      );
    }

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
    if (!c.env.JWT_SECRET) {
      throw new AssistantError(
        "JWT authentication not configured",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    const user = c.get("user");

    if (!user) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const expiresIn = 60 * 15; // 15 minutes in seconds
    const token = await generateJwtToken(user, c.env.JWT_SECRET, expiresIn);

    return c.json({
      token,
      expires_in: expiresIn,
      token_type: "Bearer",
    });
  },
);

app.route("/webauthn", authWebauthn);

app.route("/magic-link", authMagicLink);

export default app;
