import { machineRunRequestSchema, machineRunUpdateSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { callMachineRun } from "~/services/machines/runs";

const app = new Hono();
const machineParams = z.object({ machineId: z.string().min(1).max(128) });
const runParams = machineParams.extend({ runId: z.uuid() });

addRoute(app, "post", "/:machineId/runs", {
  tags: ["machines"],
  auth: true,
  paramSchema: machineParams,
  bodySchema: machineRunRequestSchema,
  handler: async ({ serviceContext, params, body }) =>
    callMachineRun(serviceContext, params.machineId, "/create", body),
});
addRoute(app, "post", "/:machineId/runs/claim", {
  tags: ["machines"],
  auth: true,
  paramSchema: machineParams,
  handler: async ({ serviceContext, params }) =>
    callMachineRun(serviceContext, params.machineId, "/claim"),
});
addRoute(app, "post", "/:machineId/runs/update", {
  tags: ["machines"],
  auth: true,
  paramSchema: machineParams,
  bodySchema: machineRunUpdateSchema,
  handler: async ({ serviceContext, params, body }) =>
    callMachineRun(serviceContext, params.machineId, "/update", body),
});
addRoute(app, "get", "/:machineId/runs/:runId", {
  tags: ["machines"],
  auth: true,
  paramSchema: runParams,
  handler: async ({ serviceContext, params }) =>
    callMachineRun(serviceContext, params.machineId, `/read/${params.runId}`),
});
addRoute(app, "post", "/:machineId/runs/:runId/cancel", {
  tags: ["machines"],
  auth: true,
  paramSchema: runParams,
  handler: async ({ serviceContext, params }) =>
    callMachineRun(serviceContext, params.machineId, `/cancel/${params.runId}`),
});

export default app;
