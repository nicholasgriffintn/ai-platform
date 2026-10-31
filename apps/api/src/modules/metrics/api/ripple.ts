import {
  clientAnalyticsBatchResponseSchema,
  clientAnalyticsBatchSchema,
} from "@ngriffin_uk/polychat-schemas";
import { readCountryCode } from "@ngriffin_uk/polychat-utility-core";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { recordClientEvents } from "~/modules/metrics/application/clientEvents";

const app = new Hono();

addRoute(app, "post", "/", {
  tags: ["system"],
  summary: "Record a batch of client analytics events",
  description:
    "Writes product analytics from the web and desktop apps to the telemetry table. Identity comes from the session.",
  auth: "user-or-anonymous",
  bodySchema: clientAnalyticsBatchSchema,
  responses: {
    200: { description: "Events accepted", schema: clientAnalyticsBatchResponseSchema },
  },
  handler: async ({ serviceContext, body, raw }) =>
    recordClientEvents(serviceContext, body, readCountryCode(raw.req.raw.cf?.country)),
});

export default app;
