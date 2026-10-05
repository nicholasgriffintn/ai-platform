import {
  siteRecordOperationSchema,
  siteRecordOperationResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";

import { executeSiteRecordOperation } from "../application/record-bindings";

const app = new Hono();

addRoute(app, "post", "/:id/record-operations", {
  tags: ["sites"],
  auth: true,
  paramSchema: z.object({ id: z.string().min(1) }),
  bodySchema: siteRecordOperationSchema,
  responses: {
    200: {
      description: "Authorised bound record operation",
      schema: siteRecordOperationResponseSchema,
    },
  },
  handler: ({ serviceContext, params, body }) =>
    executeSiteRecordOperation(serviceContext, params.id, body),
});

export default app;
