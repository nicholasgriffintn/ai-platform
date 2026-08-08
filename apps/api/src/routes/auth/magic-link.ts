import { addRoute } from "~/lib/http/routeBuilder";
import { Hono } from "hono";

import z from "zod/v4";
import {
	magicLinkRequestSchema,
	magicLinkVerifySchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { createAssistantMagicLinkAuth } from "~/services/auth/sharedAuth";
import { createSessionCookie } from "~/services/auth/sessions";
import { requestAssistantMagicLink } from "~/services/auth/magicLinkRequest";
import { AssistantError, ErrorType } from "~/utils/errors";

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
		await requestAssistantMagicLink({
			context: serviceContext,
			email: body.email,
			...(body.redirect_uri ? { redirectUri: body.redirect_uri } : {}),
		});

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
		if (body.token !== body.nonce) {
			throw new AssistantError(
				"Invalid magic-link verification data.",
				ErrorType.AUTHENTICATION_ERROR,
				401,
			);
		}
		const magicLink = createAssistantMagicLinkAuth(serviceContext, async () => {});
		const result = await magicLink.providers["magic-link"].authenticate({
			token: body.token,
		});
		if (result.status !== "authenticated") {
			throw new AssistantError(
				"Magic-link authentication did not complete.",
				ErrorType.AUTHENTICATION_ERROR,
				401,
			);
		}
		raw.header("Set-Cookie", createSessionCookie(result.session.token));

		return { success: true };
	},
});

export default app;
