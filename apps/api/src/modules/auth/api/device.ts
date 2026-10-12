import {
  deviceAuthorizationDecisionSchema,
  deviceAuthorizationParamsSchema,
  deviceAuthorizationSchema,
  deviceCodeRequestSchema,
  deviceCodeResponseSchema,
  deviceTokenRequestSchema,
  deviceTokenResponseSchema,
  errorResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import {
  decideDeviceAuthorization,
  getDeviceAuthorization,
  pollDeviceAuthorization,
  startDeviceAuthorization,
} from "~/modules/auth/application/device-authorization";

const app = new Hono();

addRoute(app, "post", "/code", {
  tags: ["auth"],
  summary: "Start device sign-in",
  description:
    "Starts an RFC 8628 device authorisation. Show the user code to the person and poll the token endpoint.",
  bodySchema: deviceCodeRequestSchema,
  responses: {
    200: { description: "Device and user codes", schema: deviceCodeResponseSchema },
    503: { description: "Device sign-in is not configured", schema: errorResponseSchema },
  },
  handler: async ({ body, raw, serviceContext }) => {
    raw.header("Cache-Control", "no-store");

    return startDeviceAuthorization(serviceContext, body.client_name);
  },
});

addRoute(app, "post", "/token", {
  tags: ["auth"],
  summary: "Poll device sign-in",
  description:
    "Returns an API key once the person approves the device. Until then it returns an RFC 8628 error code.",
  bodySchema: deviceTokenRequestSchema,
  responses: {
    200: { description: "API key for the device", schema: deviceTokenResponseSchema },
    400: {
      description: "Pending, slowed down, denied, expired or invalid",
      schema: z.object({ error: z.string() }),
    },
  },
  handler: async ({ body, raw, serviceContext }) => {
    raw.header("Cache-Control", "no-store");
    const result = await pollDeviceAuthorization(serviceContext, body.device_code);

    return "error" in result ? raw.json(result, 400) : result;
  },
});

addRoute(app, "get", "/:userCode", {
  tags: ["auth"],
  summary: "Read a pending device sign-in",
  auth: true,
  paramSchema: deviceAuthorizationParamsSchema,
  responses: {
    200: { description: "Pending device sign-in", schema: deviceAuthorizationSchema },
    404: { description: "Expired or already used", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext }) =>
    getDeviceAuthorization(serviceContext, params.userCode),
});

addRoute(app, "post", "/:userCode/decision", {
  tags: ["auth"],
  summary: "Approve or deny a device sign-in",
  auth: true,
  paramSchema: deviceAuthorizationParamsSchema,
  bodySchema: deviceAuthorizationDecisionSchema,
  responses: {
    200: {
      description: "Decision recorded",
      schema: z.object({ status: z.enum(["approved", "denied"]) }),
    },
    404: { description: "Expired or already used", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext }) =>
    decideDeviceAuthorization(serviceContext, params.userCode, body.decision),
});

export default app;
