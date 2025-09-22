import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import z from "zod/v4";

import { APP_NAME, LOCAL_HOST, PROD_HOST } from "~/constants/app";
import { Database } from "~/lib/database";
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
import { userSchema } from "../../schemas/auth";
import { errorResponseSchema } from "../../schemas/shared";
import {
  authenticationOptionsSchema,
  authenticationVerificationSchema,
  registrationOptionsSchema,
  registrationVerificationSchema,
} from "../../schemas/webAuthN";

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

app.post(
  "/registration/options",
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
            schema: resolver(errorResponseSchema),
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
  "/registration/verification",
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
            schema: resolver(errorResponseSchema),
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
  "/authentication/options",
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
            schema: resolver(errorResponseSchema),
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
  "/authentication/verification",
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
            schema: resolver(errorResponseSchema),
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
  "/passkeys",
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
  "/passkeys/:id",
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
            schema: resolver(errorResponseSchema),
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

export default app;
