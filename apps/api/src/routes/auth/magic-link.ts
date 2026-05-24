import { addRoute } from "~/lib/http/routeBuilder";
import { type Context, Hono } from "hono";

import z from "zod/v4";
import {
	magicLinkRequestSchema,
	magicLinkVerifySchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { buildMobileRedirectUri, requireMobileRedirectUri } from "~/services/auth/mobile";
import { requestMagicLink, verifyMagicLink } from "~/services/auth/magicLink";
import { createSession } from "~/services/auth/user";
import { sendMagicLinkEmail } from "~/services/notifications";

const app = new Hono();

addRoute(app, "post", "/request", {
	tags: ["auth"],
	summary: "Request a magic login link",
	bodySchema: magicLinkRequestSchema,
	responses: {
		200: {
			description: "Magic link email sent successfully",
			schema: z.object({ success: z.boolean() }),
		},
		400: {
			description: "Invalid email or user not found",
			schema: errorResponseSchema,
		},
		500: {
			description: "Server error (e.g., email sending failed)",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { email, redirect_uri } = c.req.valid("json" as never) as {
				email: string;
				redirect_uri?: string;
			};
			const { token, nonce } = await requestMagicLink(c.env, email);

			const baseUrl = c.env.APP_BASE_URL;

			if (token && nonce && baseUrl) {
				const mobileRedirectUri = redirect_uri
					? requireMobileRedirectUri(redirect_uri, "/magic-link")
					: undefined;
				const link = mobileRedirectUri
					? buildMobileRedirectUri(mobileRedirectUri, { token, nonce })
					: `${baseUrl}/auth/verify-magic-link?token=${token}&nonce=${nonce}`;
				await sendMagicLinkEmail(c.env, email, link);
			}
			return ResponseFactory.success(c, { success: true });
		})(raw),
});

addRoute(app, "post", "/verify", {
	tags: ["auth"],
	summary: "Verify magic link token and nonce, logs user in",
	bodySchema: magicLinkVerifySchema,
	responses: {
		200: {
			description: "Login successful",
			schema: z.object({ success: z.boolean() }),
		},
		400: {
			description: "Missing or invalid token/nonce in body",
			schema: errorResponseSchema,
		},
		401: {
			description: "Invalid or expired token/nonce",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { token, nonce } = c.req.valid("json" as never) as {
				token: string;
				nonce: string;
			};

			const userId = await verifyMagicLink(c.env, token, nonce);
			const { repositories } = getServiceContext(c);
			const sessionId = await createSession(repositories, userId);

			c.header(
				"Set-Cookie",
				`session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
			); // 7 days

			return ResponseFactory.success(c, { success: true });
		})(raw),
});

export default app;
