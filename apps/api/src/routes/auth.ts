import { Octokit } from "@octokit/rest";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";
import { z } from "zod";

import { Database } from "~/lib/database";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { generateJwtToken } from "~/services/auth/jwt";
import { sendMagicLinkEmail } from "~/services/auth/magicLink";
import {
  requestMagicLink,
  verifyMagicLink,
} from "~/services/auth/magicLinkService";
import {
  createOrUpdateGithubUser,
  createSession,
  deleteSession,
  getUserSettings,
} from "~/services/auth/user";
import {
  deletePasskey,
  generatePasskeyAuthenticationOptions,
  generatePasskeyRegistrationOptions,
  getUserPasskeys,
  verifyAndRegisterPasskey,
  verifyPasskeyAuthentication,
} from "~/services/auth/webauthn";
import type { AnonymousUser, User } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import {
  githubCallbackSchema,
  githubLoginSchema,
  jwtTokenResponseSchema,
  userSchema,
} from "./schemas/auth";
import { magicLinkVerifySchema } from "./schemas/magicLink";
import { errorResponseSchema } from "./schemas/shared";
import {
  authenticationOptionsSchema,
  authenticationVerificationSchema,
  registrationOptionsSchema,
  registrationVerificationSchema,
} from "./schemas/webAuthN";

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
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: "Server error, such as missing configuration",
        content: {
          "application/json": {
            schema: errorResponseSchema,
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
            schema: errorResponseSchema,
          },
        },
      },
      401: {
        description: "Authentication error",
        content: {
          "application/json": {
            schema: errorResponseSchema,
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
                userSettings: z.record(z.any()).optional(),
              }),
            ),
          },
        },
      },
      401: {
        description: "Invalid or expired session",
        content: {
          "application/json": {
            schema: errorResponseSchema,
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
            schema: errorResponseSchema,
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
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: "JWT secret not configured",
        content: {
          "application/json": {
            schema: errorResponseSchema,
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

    const expiresIn = 60 * 60 * 24 * 7; // 7 days in seconds
    const token = await generateJwtToken(user, c.env.JWT_SECRET, expiresIn);

    return c.json({
      token,
      expires_in: expiresIn,
      token_type: "Bearer",
    });
  },
);

const rpName = "Polychat";
const rpID = (c) => {
  const isDev = c.env.ENV === "development" || c.env.NODE_ENV === "development";
  return isDev ? "localhost" : "polychat.app";
};
const getOrigin = (c) => {
  const isDev = c.env.ENV === "development" || c.env.NODE_ENV === "development";
  if (isDev) {
    return "https://localhost:5173";
  }

  return "https://polychat.app";
};

app.post(
  "/webauthn/registration/options",
  describeRoute({
    tags: ["auth"],
    summary: "Generate WebAuthn registration options",
    responses: {
      200: {
        description: "Returns registration options for the authenticator",
        content: {
          "application/json": {
            schema: resolver(z.any()),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  requireAuth,
  zValidator("json", registrationOptionsSchema),
  async (c: Context) => {
    const user = c.get("user");

    if (!user?.id) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);

    const options = await generatePasskeyRegistrationOptions(
      database,
      user,
      rpName,
      rpID(c),
    );

    return c.json(options);
  },
);

app.post(
  "/webauthn/registration/verification",
  describeRoute({
    tags: ["auth"],
    summary: "Verify WebAuthn registration response",
    responses: {
      200: {
        description: "Registration successful",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                verified: z.boolean(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Invalid verification response",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  requireAuth,
  zValidator("json", registrationVerificationSchema),
  async (c: Context) => {
    const user = c.get("user");

    if (!user?.id) {
      throw new AssistantError(
        "Authentication required",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);
    const { response } = await c.req.json<{
      response: RegistrationResponseJSON;
    }>();

    const verified = await verifyAndRegisterPasskey(
      database,
      user,
      response,
      getOrigin(c),
      rpID(c),
    );

    return c.json({ verified });
  },
);

app.post(
  "/webauthn/authentication/options",
  describeRoute({
    tags: ["auth"],
    summary: "Generate WebAuthn authentication options",
    responses: {
      200: {
        description: "Returns authentication options for the authenticator",
        content: {
          "application/json": {
            schema: resolver(z.any()),
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  zValidator("json", authenticationOptionsSchema),
  async (c: Context) => {
    const database = Database.getInstance(c.env);

    const options = await generatePasskeyAuthenticationOptions(
      database,
      rpID(c),
    );

    return c.json(options);
  },
);

app.post(
  "/webauthn/authentication/verification",
  describeRoute({
    tags: ["auth"],
    summary: "Verify WebAuthn authentication response",
    responses: {
      200: {
        description: "Authentication successful, returns user session",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                verified: z.boolean(),
                user: userSchema.optional(),
              }),
            ),
          },
        },
      },
      400: {
        description: "Invalid verification response",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  zValidator("json", authenticationVerificationSchema),
  async (c: Context) => {
    const database = Database.getInstance(c.env);
    const requestData = await c.req.json<{
      response: AuthenticationResponseJSON;
    }>();

    const { verified, user } = await verifyPasskeyAuthentication(
      database,
      requestData.response,
      getOrigin(c),
      rpID(c),
    );

    if (verified && user && user.id) {
      const sessionId = await createSession(database, user.id);

      c.header(
        "Set-Cookie",
        `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
      ); // 7 days
    }

    return c.json({ verified, user });
  },
);

app.get(
  "/webauthn/passkeys",
  describeRoute({
    tags: ["auth"],
    summary: "Get all passkeys for the authenticated user",
    responses: {
      200: {
        description: "List of user's passkeys",
        content: {
          "application/json": {
            schema: resolver(
              z.array(
                z.object({
                  id: z.number(),
                  device_type: z.string(),
                  created_at: z.string(),
                  backed_up: z.boolean(),
                }),
              ),
            ),
          },
        },
      },
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: errorResponseSchema,
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

    const database = Database.getInstance(c.env);

    const passkeys = await getUserPasskeys(database, user.id);

    const formattedPasskeys = passkeys.map((passkey) => ({
      id: passkey.id,
      device_type: passkey.device_type,
      created_at: passkey.created_at,
      backed_up: Boolean(passkey.backed_up),
    }));

    return c.json(formattedPasskeys);
  },
);

app.delete(
  "/webauthn/passkeys/:id",
  describeRoute({
    tags: ["auth"],
    summary: "Delete a passkey for the authenticated user",
    responses: {
      200: {
        description: "Passkey deleted successfully",
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
      401: {
        description: "Authentication required",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
      400: {
        description: "Bad request or validation error",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                error: z.string(),
                type: z.string(),
              }),
            ),
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

    const passkeyId = Number.parseInt(c.req.param("id"), 10);

    if (Number.isNaN(passkeyId)) {
      throw new AssistantError(
        "Invalid passkey ID",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    const database = Database.getInstance(c.env);

    const success = await deletePasskey(database, passkeyId, user.id);

    if (!success) {
      throw new AssistantError(
        "Failed to delete passkey or passkey not found",
        ErrorType.AUTHENTICATION_ERROR,
      );
    }

    return c.json({ success });
  },
);

const magicLinkRequestSchema = z.object({
  email: z.string().email("Invalid email format"),
});

app.post(
  "/magic-link/request",
  describeRoute({
    tags: ["auth"],
    summary: "Request a magic login link",
    request: {
      body: {
        content: {
          "application/json": {
            schema: magicLinkRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Magic link email sent successfully",
        content: {
          "application/json": {
            schema: resolver(z.object({ success: z.boolean() })),
          },
        },
      },
      400: {
        description: "Invalid email or user not found",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
      500: {
        description: "Server error (e.g., email sending failed)",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  zValidator("json", magicLinkRequestSchema),
  async (c: Context) => {
    const { email } = c.req.valid("json" as never) as { email: string };
    const { token, nonce } = await requestMagicLink(c.env, email);

    const baseUrl = c.env.APP_BASE_URL;

    if (token && nonce && baseUrl) {
      const link = `${baseUrl}/auth/verify-magic-link?token=${token}&nonce=${nonce}`;
      await sendMagicLinkEmail(c, email, link);
    }
    return c.json({ success: true });
  },
);

app.post(
  "/magic-link/verify",
  describeRoute({
    tags: ["auth"],
    summary: "Verify magic link token and nonce, logs user in",
    request: {
      body: {
        content: {
          "application/json": {
            schema: magicLinkVerifySchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: resolver(z.object({ success: z.boolean() })),
          },
        },
      },
      400: {
        description: "Missing or invalid token/nonce in body",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
      401: {
        description: "Invalid or expired token/nonce",
        content: {
          "application/json": {
            schema: errorResponseSchema,
          },
        },
      },
    },
  }),
  zValidator("json", magicLinkVerifySchema),
  async (c: Context) => {
    const { token, nonce } = c.req.valid("json" as never) as {
      token: string;
      nonce: string;
    };

    const userId = await verifyMagicLink(c.env, token, nonce);
    const database = Database.getInstance(c.env);
    const sessionId = await createSession(database, userId);

    c.header(
      "Set-Cookie",
      `session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
    ); // 7 days

    return c.json({ success: true });
  },
);

export default app;
