import { Octokit } from "@octokit/rest";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { requireAuth } from "../middleware/auth";
import { createRouteLogger } from "../middleware/loggerMiddleware";
import { generateJwtToken } from "../services/auth/jwt";
import {
  createOrUpdateGithubUser,
  createSession,
  deleteSession,
  getUserBySessionId,
} from "../services/auth/user";
import { AssistantError, ErrorType } from "../utils/errors";
import {
  githubCallbackSchema,
  githubLoginSchema,
  jwtTokenResponseSchema,
  userSchema,
} from "./schemas/auth";

const app = new Hono();

const routeLogger = createRouteLogger("AUTH");

/**
 * Global middleware to add route-specific logging
 */
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
    },
  }),
  zValidator("query", githubCallbackSchema),
  async (c: Context) => {
    const { code } = c.req.valid("query" as never) as { code: string };

    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) {
      throw new AssistantError(
        "Missing GitHub OAuth configuration",
        ErrorType.CONFIGURATION_ERROR,
      );
    }

    try {
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

      const user = await createOrUpdateGithubUser(c.env.DB, {
        githubId: githubUser.id.toString(),
        username: githubUser.login,
        email: primaryEmail,
        name: githubUser.name || undefined,
        avatarUrl: githubUser.avatar_url,
        company: githubUser.company || undefined,
        location: githubUser.location || undefined,
        bio: githubUser.bio || undefined,
        twitterUsername: githubUser.twitter_username || undefined,
        site: githubUser.blog || undefined,
      });

      const sessionId = await createSession(c.env.DB, user.id);

      c.header(
        "Set-Cookie",
        `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
      ); // 7 days

      const redirectUri = c.env.AUTH_REDIRECT_URL;
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
            schema: resolver(userSchema),
          },
        },
      },
    },
  }),
  async (c: Context) => {
    const cookies = c.req.header("Cookie") || "";
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    const authHeader = c.req.header("Authorization");
    const headerSessionId = authHeader?.startsWith("Bearer ")
      ? authHeader.split("Bearer ")[1]
      : null;

    const finalSessionId = sessionId || headerSessionId;

    if (!finalSessionId) {
      return c.json({ user: null });
    }

    const user = await getUserBySessionId(c.env, finalSessionId);

    if (!user) {
      throw new AssistantError(
        "Invalid or expired session",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return c.json({ user });
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
    },
  }),
  async (c: Context) => {
    const cookies = c.req.header("Cookie") || "";
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (sessionId) {
      await deleteSession(c.env.DB, sessionId);

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
      },
      500: {
        description: "JWT secret not configured",
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

    const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds
    const token = await generateJwtToken(user, c.env.JWT_SECRET, expiresIn);

    return c.json({
      token,
      expires_in: expiresIn,
      token_type: "Bearer",
    });
  },
);

export default app;
