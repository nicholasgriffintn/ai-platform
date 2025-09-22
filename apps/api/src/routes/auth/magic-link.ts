import { type Context, Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi";
import z from "zod/v4";

import { Database } from "~/lib/database";
import { requestMagicLink, verifyMagicLink } from "~/services/auth/magicLink";
import { createSession } from "~/services/auth/user";
import { sendMagicLinkEmail } from "~/services/notifications";
import {
  magicLinkRequestSchema,
  magicLinkVerifySchema,
} from "../schemas/magicLink";
import { errorResponseSchema } from "../schemas/shared";

const app = new Hono();

app.post(
  "/request",
  describeRoute({
    tags: ["auth"],
    summary: "Request a magic login link",
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
            schema: resolver(errorResponseSchema),
          },
        },
      },
      500: {
        description: "Server error (e.g., email sending failed)",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
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
      await sendMagicLinkEmail(c.env, email, link);
    }
    return c.json({ success: true });
  },
);

app.post(
  "/verify",
  describeRoute({
    tags: ["auth"],
    summary: "Verify magic link token and nonce, logs user in",
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
            schema: resolver(errorResponseSchema),
          },
        },
      },
      401: {
        description: "Invalid or expired token/nonce",
        content: {
          "application/json": {
            schema: resolver(errorResponseSchema),
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
