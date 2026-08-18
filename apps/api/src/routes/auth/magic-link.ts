import {
  magicLinkRequestSchema,
  magicLinkVerifySchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { requestAssistantMagicLink } from "~/services/auth/magicLinkRequest";
import { createSessionCookie } from "~/services/auth/sessions";
import { createAssistantMagicLinkAuth } from "~/services/auth/sharedAuth";
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
  summary: "Verify a magic-link token and log the user in",
  bodySchema: magicLinkVerifySchema,
  responses: {
    200: {
      description: "Login successful",
      schema: z.object({ success: z.boolean() }),
    },
    400: {
      description: "Missing or invalid token in body",
      schema: errorResponseSchema,
    },
    401: {
      description: "Invalid or expired token",
      schema: errorResponseSchema,
    },
  },
  handler: async ({ body, raw, serviceContext }) => {
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
