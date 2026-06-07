import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import z from "zod/v4";
import {
	magicLinkRequestSchema,
	magicLinkVerifySchema,
	errorResponseSchema,
} from "@assistant/schemas";

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
	handler: async ({ body, serviceContext }) => {
		const { token, nonce } = await requestMagicLink(serviceContext.env, body.email);
		const baseUrl = serviceContext.env.APP_BASE_URL;

		if (token && nonce && baseUrl) {
			const mobileRedirectUri = body.redirect_uri
				? requireMobileRedirectUri(body.redirect_uri, "/magic-link")
				: undefined;
			const link = mobileRedirectUri
				? buildMobileRedirectUri(mobileRedirectUri, { token, nonce })
				: `${baseUrl}/auth/verify-magic-link?token=${token}&nonce=${nonce}`;
			await sendMagicLinkEmail(serviceContext.env, body.email, link);
		}

		return { success: true };
	},
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
	handler: async ({ body, raw, serviceContext }) => {
		const userId = await verifyMagicLink(serviceContext.env, body.token, body.nonce);
		const sessionId = await createSession(serviceContext.repositories, userId);

		raw.header(
			"Set-Cookie",
			`session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
		);

		return { success: true };
	},
});

export default app;
