import {
  errorResponseSchema,
  machineHeartbeatSchema,
  machineRecordSchema,
  machineRunUpdateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { heartbeatMachine } from "~/modules/machines/application";
import { callMachineRun } from "~/modules/machines/application/runs";

const app = new Hono();
const machineParamsSchema = z.object({ machine_id: z.string().min(1).max(128) });

defineResource(app, { idParam: "machine_id", tags: ["machines"] }, (machines) => {
  machines.collectionAction("heartbeat", {
    auth: true,
    summary: "Advertise a desktop machine",
    description: "Publishes account-scoped runtime metadata for a signed-in desktop.",
    bodySchema: machineHeartbeatSchema,
    responses: {
      200: { description: "Machine heartbeat accepted", schema: machineRecordSchema.nullable() },
      400: { description: "Invalid machine heartbeat", schema: errorResponseSchema },
    },
    handler: ({ body, serviceContext, user }) => heartbeatMachine(serviceContext, body, user.id),
  });

  const runs = machines.sub("runs", "run_id");

  runs.collectionAction("claim", {
    auth: true,
    summary: "Claim the next run for this machine",
    paramSchema: machineParamsSchema,
    handler: ({ serviceContext, params }) =>
      callMachineRun(serviceContext, params.machine_id, "/claim"),
  });

  runs.collectionAction("update", {
    auth: true,
    summary: "Report progress for a claimed run",
    paramSchema: machineParamsSchema,
    bodySchema: machineRunUpdateSchema,
    handler: ({ serviceContext, params, body }) =>
      callMachineRun(serviceContext, params.machine_id, "/update", body),
  });
});

export default app;
