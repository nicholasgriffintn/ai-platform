import {
  errorResponseSchema,
  machineActivityResponseSchema,
  machineActivitySchema,
  machineForgetResponseSchema,
  machineHeartbeatSchema,
  machineRecordSchema,
  machineRunUpdateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { recordDeviceActivity } from "~/modules/discover/application/device-activity";
import { forgetDeviceActivity } from "~/modules/discover/application/device-documents";
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

  machines
    .singleton("activity")
    .update({
      auth: true,
      summary: "Replace this machine's shared activity",
      description:
        "Stores the activity digests a desktop chose to share as Discover documents. Sources left out are removed.",
      paramSchema: machineParamsSchema,
      bodySchema: machineActivitySchema,
      responses: {
        200: { description: "Activity recorded", schema: machineActivityResponseSchema },
        400: { description: "Invalid activity", schema: errorResponseSchema },
      },
      handler: ({ body, params, serviceContext }) =>
        recordDeviceActivity(serviceContext, params.machine_id, body),
    })
    .delete({
      auth: true,
      summary: "Forget this machine's shared activity",
      paramSchema: machineParamsSchema,
      responses: {
        200: { description: "Activity forgotten", schema: machineForgetResponseSchema },
      },
      handler: async ({ params, serviceContext }) => {
        await forgetDeviceActivity(serviceContext, { machineId: params.machine_id });

        return { forgotten: true };
      },
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
