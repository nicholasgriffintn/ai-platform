import {
  errorResponseSchema,
  machineForgetResponseSchema,
  machineHeartbeatSchema,
  machineListResponseSchema,
  machineRecordSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { forgetMachine, heartbeatMachine, listMachines } from "~/services/machines";

import machineRuns from "./machine-runs";

const app = new Hono();

app.route("/", machineRuns);

addRoute(app, "post", "/heartbeat", {
  tags: ["machines"],
  summary: "Advertise a desktop machine",
  description: "Publishes account-scoped runtime metadata for a signed-in desktop.",
  auth: true,
  bodySchema: machineHeartbeatSchema,
  responses: {
    200: {
      description: "Machine heartbeat accepted",
      schema: machineRecordSchema.nullable(),
    },
    400: { description: "Invalid machine heartbeat", schema: errorResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ body, serviceContext, user }) =>
    heartbeatMachine(serviceContext, body, user.id),
});

addRoute(app, "get", "/", {
  tags: ["machines"],
  summary: "List account machines",
  description: "Returns desktop machines advertised by the signed-in account.",
  auth: true,
  responses: {
    200: { description: "Account machines", schema: machineListResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, user }) => listMachines(serviceContext, user.id),
});

addRoute(app, "delete", "/:id", {
  tags: ["machines"],
  summary: "Forget an account machine",
  description: "Removes one advertised machine from the signed-in account.",
  auth: true,
  paramSchema: z.object({ id: z.string().trim().min(1).max(128) }),
  responses: {
    200: { description: "Machine forgotten", schema: machineForgetResponseSchema },
    401: { description: "Authentication required", schema: errorResponseSchema },
  },
  handler: async ({ params, serviceContext, user }) =>
    forgetMachine(serviceContext, params.id, user.id),
});

export default app;
