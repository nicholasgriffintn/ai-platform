import { addRoute } from "~/lib/http/routeBuilder";
import type {
	AuthenticationResponseJSON,
	RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { type Context, Hono } from "hono";

import z from "zod/v4";
import {
	userSchema,
	authenticationOptionsSchema,
	authenticationVerificationSchema,
	registrationOptionsSchema,
	registrationVerificationSchema,
	errorResponseSchema,
} from "@assistant/schemas";

import { APP_NAME, LOCAL_HOST, PROD_HOST } from "~/constants/app";
import { getServiceContext } from "~/lib/context/serviceContext";
import { ResponseFactory } from "~/lib/http/ResponseFactory";
import { requireAuth } from "~/middleware/auth";
import { createSession } from "~/services/auth/user";
import {
	deletePasskey,
	generatePasskeyAuthenticationOptions,
	generatePasskeyRegistrationOptions,
	getUserPasskeys,
	verifyAndRegisterPasskey,
	verifyPasskeyAuthentication,
} from "~/services/auth/webauthn";
import { AssistantError, ErrorType } from "~/utils/errors";

const app = new Hono();

const rpName = APP_NAME;
const rpID = (c) => {
	const isDev = c.env.ENV === "development" || c.env.NODE_ENV === "development";
	return isDev ? LOCAL_HOST : PROD_HOST;
};
const getOrigin = (c) => {
	const isDev = c.env.ENV === "development" || c.env.NODE_ENV === "development";
	if (isDev) {
		return `https://${LOCAL_HOST}`;
	}

	return `https://${PROD_HOST}`;
};

addRoute(app, "post", "/registration/options", {
	tags: ["auth"],
	summary: "Generate WebAuthn registration options",
	bodySchema: registrationOptionsSchema,
	responses: {
		200: {
			description: "Returns registration options for the authenticator",
			schema: z.any(),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const { repositories } = getServiceContext(c);

			const options = await generatePasskeyRegistrationOptions(
				repositories,
				user,
				rpName,
				rpID(c),
			);

			return ResponseFactory.success(c, options);
		})(raw),
});

addRoute(app, "post", "/registration/verification", {
	tags: ["auth"],
	summary: "Verify WebAuthn registration response",
	bodySchema: registrationVerificationSchema,
	responses: {
		200: {
			description: "Registration successful",
			schema: z.object({
				verified: z.boolean(),
			}),
		},
		400: {
			description: "Invalid verification response",
			schema: errorResponseSchema,
		},
	},
	middleware: [requireAuth],
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const user = c.get("user");

			if (!user?.id) {
				throw new AssistantError(
					"Authentication required",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const { repositories } = getServiceContext(c);
			const { response } = await c.req.json<{
				response: RegistrationResponseJSON;
			}>();

			const verified = await verifyAndRegisterPasskey(
				repositories,
				user,
				response,
				getOrigin(c),
				rpID(c),
			);

			return ResponseFactory.success(c, { verified });
		})(raw),
});

addRoute(app, "post", "/authentication/options", {
	tags: ["auth"],
	summary: "Generate WebAuthn authentication options",
	bodySchema: authenticationOptionsSchema,
	responses: {
		200: {
			description: "Returns authentication options for the authenticator",
			schema: z.any(),
		},
		400: {
			description: "Bad request or validation error",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { repositories } = getServiceContext(c);

			const options = await generatePasskeyAuthenticationOptions(
				repositories,
				rpID(c),
			);

			return ResponseFactory.success(c, options);
		})(raw),
});

addRoute(app, "post", "/authentication/verification", {
	tags: ["auth"],
	summary: "Verify WebAuthn authentication response",
	bodySchema: authenticationVerificationSchema,
	responses: {
		200: {
			description: "Authentication successful, returns user session",
			schema: z.object({
				verified: z.boolean(),
				user: userSchema.optional(),
			}),
		},
		400: {
			description: "Invalid verification response",
			schema: errorResponseSchema,
		},
	},
	handler: async ({ raw }) =>
		(async (c: Context) => {
			const { repositories } = getServiceContext(c);
			const requestData = await c.req.json<{
				response: AuthenticationResponseJSON;
			}>();

			const { verified, user } = await verifyPasskeyAuthentication(
				repositories,
				requestData.response,
				getOrigin(c),
				rpID(c),
			);

			if (verified && user && user.id) {
				const sessionId = await createSession(repositories, user.id);

				c.header(
					"Set-Cookie",
					`session=${sessionId}; HttpOnly; Path=/; SameSite=Lax; Max-Age=604800`,
				); // 7 days
			}

			return ResponseFactory.success(c, { verified, user });
		})(raw),
});

addRoute(app, "get", "/passkeys", {
	tags: ["auth"],
	summary: "Get all passkeys for the authenticated user",
	responses: {
		200: {
			description: "List of user's passkeys",
			schema: z.array(
				z.object({
					id: z.number(),
					device_type: z.string(),
					created_at: z.string(),
					backed_up: z.boolean(),
				}),
			),
		},
		401: {
			description: "Authentication required",
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

			const { repositories } = getServiceContext(c);

			const passkeys = await getUserPasskeys(repositories, user.id);

			const formattedPasskeys = passkeys.map((passkey) => ({
				id: passkey.id,
				device_type: passkey.device_type,
				created_at: passkey.created_at,
				backed_up: Boolean(passkey.backed_up),
			}));

			return ResponseFactory.success(c, formattedPasskeys);
		})(raw),
});

addRoute(app, "delete", "/passkeys/:id", {
	tags: ["auth"],
	summary: "Delete a passkey for the authenticated user",
	responses: {
		200: {
			description: "Passkey deleted successfully",
			schema: z.object({
				success: z.boolean(),
			}),
		},
		401: {
			description: "Authentication required",
			schema: errorResponseSchema,
		},
		400: {
			description: "Bad request or validation error",
			schema: z.object({
				error: z.string(),
				type: z.string(),
			}),
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

			const passkeyId = Number.parseInt(c.req.param("id"), 10);

			if (Number.isNaN(passkeyId)) {
				throw new AssistantError(
					"Invalid passkey ID",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			const { repositories } = getServiceContext(c);

			const success = await deletePasskey(repositories, passkeyId, user.id);

			if (!success) {
				throw new AssistantError(
					"Failed to delete passkey or passkey not found",
					ErrorType.AUTHENTICATION_ERROR,
				);
			}

			return ResponseFactory.success(c, { success });
		})(raw),
});

export default app;
