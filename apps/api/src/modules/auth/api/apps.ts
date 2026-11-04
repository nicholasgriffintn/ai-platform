import {
  appAuthorisationStartResponseSchema,
  appAuthorisationStartSchema,
  appTokenRequestSchema,
  appTokenResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  exchangeAppCode,
  startAppAuthorisation,
} from "~/modules/auth/application/app-authorisation";

const app = new Hono();

addRoute(app, "post", "/start", {
  tags: ["auth"],
  summary: "Start connecting a registered app",
  description:
    "Starts an authorisation for a registered app. Send the person to the returned address. Their answer comes back to the registered redirect address with the state you sent.",
  bodySchema: appAuthorisationStartSchema,
  responses: {
    200: { description: "Where to send the person", schema: appAuthorisationStartResponseSchema },
    400: { description: "Unregistered redirect address", schema: errorResponseSchema },
  },
  handler: ({ body, raw, serviceContext }) => {
    raw.header("Cache-Control", "no-store");

    return startAppAuthorisation(serviceContext, body);
  },
});

addRoute(app, "post", "/token", {
  tags: ["auth"],
  summary: "Exchange an app authorisation code",
  description:
    "Swaps a one-time code and its PKCE verifier for an API key. Earlier keys this app holds for the account are revoked.",
  bodySchema: appTokenRequestSchema,
  responses: {
    200: { description: "API key for the app", schema: appTokenResponseSchema },
    400: { description: "Invalid code", schema: z.object({ error: z.string() }) },
  },
  handler: async ({ body, raw, serviceContext }) => {
    raw.header("Cache-Control", "no-store");
    const result = await exchangeAppCode(serviceContext, body);

    return "error" in result ? raw.json(result, 400) : result;
  },
});

export default app;
