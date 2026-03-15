import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import z from "zod/v4";
import {
	githubCallbackSchema,
	githubLoginSchema,
	jwtTokenResponseSchema,
	userSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { requireAuth } from "~/middleware/auth";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
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
import authMagicLink from "./magic-link";
import authWebauthn from "./webauthn";

const logger = getLogger({ prefix: "routes/auth" });

const app = new Hono();

const routeLogger = createRouteLogger("auth");

app.use("/*", (c, next) => {
	routeLogger.info(`Processing auth route: ${c.req.path}`);
	return next();
});

addRoute(app, "get", "/github", {
	tags: ["auth"],
	summary: "Initiates GitHub OAuth flow",
	querySchema: githubLoginSchema,
	responses: {
		200: {
			description:
				"Redirects to GitHub OAuth authorization page to authenticate the user",
			schema: z.object({}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
		500: {
			description: "Server error, such as missing configuration",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const githubAuthUrl = getGitHubAuthUrl(c.env);
			return c.redirect(githubAuthUrl);
		})(raw),
});

addRoute(app, "get", "/github/callback", {
	tags: ["auth"],
	summary: "GitHub OAuth callback handler",
	querySchema: githubCallbackSchema,
	responses: {
		200: {
			description:
				"Given a GitHub OAuth code, this endpoint will authenticate the user and redirect to the original URL",
			schema: z.object({}),
		},
		400: {
			description: "Bad request or invalid code",
			schema: errorResponseSchema,
		},
		401: { description: "Authentication error", schema: errorResponseSchema },
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { code } = c.req.valid("query" as never) as { code: string };

			const serviceContext = getServiceContext(c);
			const { user: _user, sessionId } = await handleGitHubOAuthCallback({
				context: serviceContext,
				code,
			});

			c.header("Set-Cookie", createSessionCookie(sessionId));

			const redirectUri = `${c.env.APP_BASE_URL}/auth/callback`;
			return c.redirect(redirectUri);
		})(raw),
});

addRoute(app, "get", "/me", {
	tags: ["auth"],
	summary: "Get current user info",
	responses: {
		200: {
			description: "Returns the current user's information",
			schema: z.object({
				user: userSchema.nullable(),
				userSettings: z.record(z.string(), z.any()).optional(),
			}),
		},
		401: {
			description: "Invalid or expired session",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user") as User | undefined;

			if (!user) {
				const anonymousUser = c.get("anonymousUser") as
					| AnonymousUser
					| undefined;
				if (anonymousUser) {
					return ResponseFactory.success(c, {
						user: null,
						userSettings: null,
						anon: anonymousUser,
					});
				}
				return ResponseFactory.success(c, { user: null, userSettings: null });
			}

			try {
				const { repositories } = getServiceContext(c);
				const userSettings = await getUserSettings(repositories, user.id);
				return ResponseFactory.success(c, { user, userSettings });
			} catch (error) {
				logger.error(`Error fetching user settings for user ${user.id}:`, {
					error,
				});
				return ResponseFactory.success(c, { user, userSettings: null });
			}
		})(raw),
});

addRoute(app, "post", "/logout", {
	tags: ["auth"],
	summary: "Logout - clear session",
	responses: {
		200: {
			description: "Clears the session and logs the user out",
			schema: z.object({
				success: z.boolean(),
			}),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const cookies = c.req.header("Cookie") || "";
			const sessionId = extractSessionIdFromCookies(cookies);

			const serviceContext = getServiceContext(c);
			await handleLogout({
				context: serviceContext,
				sessionId,
			});

			c.header("Set-Cookie", createLogoutCookie());

			return ResponseFactory.success(c, {
				success: true,
			});
		})(raw),
});

addRoute(app, "get", "/token", {
	tags: ["auth"],
	summary: "Generate a JWT token for the authenticated user",
	responses: {
		200: {
			description: "Returns a JWT token for the authenticated user",
			schema: jwtTokenResponseSchema,
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		500: {
			description: "JWT secret not configured",
			schema: errorResponseSchema,
		},
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const cookies = c.req.header("Cookie") || "";
			const sessionId = extractSessionIdFromCookies(cookies);

			const serviceContext = getServiceContext(c);
			const { token, expires_in } = await generateUserToken({
				context: serviceContext,
				user,
				sessionId,
			});

			return ResponseFactory.success(c, {
				token,
				expires_in: expires_in,
				token_type: "Bearer",
			});
		})(raw),
});

app.route("/webauthn", authWebauthn);

app.route("/magic-link", authMagicLink);

export default app;
