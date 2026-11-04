import {
  errorResponseSchema,
  pashiLinkRequestSchema,
  pashiLinkSaveResultSchema,
  pashiLinkStatusSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import { getPashiLinkStatus, removePashiLink, savePashiLink } from "../application/link";

const app = new Hono();

addRoute(app, "get", "/link", {
  tags: ["auth"],
  summary: "Read the Pashi link",
  description: "Says whether Pashi is linked to this account and whether the account is on Pro.",
  auth: true,
  responses: {
    200: { description: "Link status", schema: pashiLinkStatusSchema },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, user }) => getPashiLinkStatus(serviceContext, user),
});

addRoute(app, "put", "/link", {
  tags: ["auth"],
  summary: "Link Pashi tools",
  description: "Stores the per-user credential Polychat uses to call Pashi tools for this account.",
  auth: true,
  bodySchema: pashiLinkRequestSchema,
  responses: {
    200: { description: "Link status", schema: pashiLinkSaveResultSchema },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  handler: ({ serviceContext, user, body }) => savePashiLink(serviceContext, user, body.token),
});

addRoute(app, "delete", "/link", {
  tags: ["auth"],
  summary: "Remove the Pashi link",
  description:
    "Disconnects Pashi in both directions: forgets its credential and revokes its Polychat key.",
  auth: true,
  responses: {
    200: { description: "Link removed", schema: z.object({ linked: z.literal(false) }) },
    401: { description: "Authentication error", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, user }) => {
    await removePashiLink(serviceContext, user);

    return { linked: false as const };
  },
});

export default app;
