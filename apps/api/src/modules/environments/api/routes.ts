import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  computerUseAvailabilitySchema,
  createSandboxPreviewRequestSchema,
  environmentActionSchema,
  environmentAvailabilityQuerySchema,
  environmentListSchema,
  environmentParamsSchema,
  environmentPreviewParamsSchema,
  environmentQuerySchema,
  environmentRunParamsSchema,
  environmentSchema,
  errorResponseSchema,
  listEnvironmentsQuerySchema,
  listPageOf,
  listRunInstructionsQuerySchema,
  machineRunRequestSchema,
  recordGoalIterationRequestSchema,
  sandboxRunUsageReportSchema,
  setGoalRequestSchema,
  submitRunInstructionSchema,
  updateGoalRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { requirePlan } from "~/middleware/requirePlan";
import {
  createSandboxPreview,
  getSandboxPreview,
  revokeSandboxPreview,
} from "~/modules/apps/application/sandbox/previews";
import {
  getSandboxRunControlState,
  listSandboxRunEventsForUser,
  listSandboxRunInstructionsForUser,
  requestSandboxRunInstruction,
} from "~/modules/apps/application/sandbox/runs";
import { recordSandboxRunUsage } from "~/modules/apps/application/sandbox/usage";
import { getComputerUseAvailability } from "~/modules/computer-use/application/access";
import {
  handleGetRunGoal,
  handleRecordRunGoalIteration,
  handleSetRunGoal,
  handleUpdateRunGoal,
} from "~/modules/conversations/application/conversationGoal";
import { callMachineRun } from "~/modules/machines/application/runs";

import {
  actOnEnvironment,
  listEnvironments,
  readEnvironment,
  removeEnvironment,
} from "../application/environments";

const app = new Hono();
const sandboxOnly = [requirePlan("pro")];

app.use("*", async (context, next) => {
  context.header("Cache-Control", "no-store");
  await next();
});

defineResource(app, { idParam: "environment_id", tags: ["environments"] }, (environments) => {
  environments
    .list({
      auth: true,
      summary: "List environments",
      description: "Lists the machines and other places work can run for the caller.",
      querySchema: listEnvironmentsQuerySchema,
      responses: { 200: { description: "Environments", schema: environmentListSchema } },
      handler: ({ serviceContext, user, query }) =>
        listEnvironments({ context: serviceContext, user }, query.kind),
    })
    .view("availability", {
      auth: true,
      summary: "Check browser and computer availability",
      querySchema: environmentAvailabilityQuerySchema,
      responses: {
        200: { description: "Computer use availability", schema: computerUseAvailabilitySchema },
      },
      handler: ({ serviceContext, query }) =>
        getComputerUseAvailability(serviceContext, query.project_id, query.workspace_id),
    })
    .read({
      auth: true,
      summary: "Get an environment",
      description:
        "Returns a sandbox run, browser session, teammate computer or machine. Pass kind to skip resolution.",
      paramSchema: environmentParamsSchema,
      querySchema: environmentQuerySchema,
      responses: {
        200: { description: "The environment", schema: environmentSchema },
        404: { description: "Environment not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, user, params, query }) =>
        readEnvironment({ context: serviceContext, user }, params.environment_id, query.kind),
    })
    .delete({
      auth: true,
      summary: "Close or forget an environment",
      paramSchema: environmentParamsSchema,
      querySchema: environmentQuerySchema,
      responses: { 409: { description: "Cannot be removed", schema: errorResponseSchema } },
      handler: ({ serviceContext, user, params, query }) =>
        removeEnvironment({ context: serviceContext, user }, params.environment_id, query.kind),
    });

  environments.sub("actions", "action_id").create({
    auth: true,
    summary: "Act on an environment",
    description:
      "Takes over, views, releases, pauses, resumes, cancels, stops or answers an approval, depending on what the environment supports.",
    paramSchema: environmentParamsSchema,
    querySchema: environmentQuerySchema,
    bodySchema: environmentActionSchema,
    responses: {
      200: { description: "The action result" },
      409: {
        description: "The environment does not support the action",
        schema: errorResponseSchema,
      },
    },
    handler: ({ serviceContext, user, params, query, body }) =>
      actOnEnvironment({ context: serviceContext, user }, params.environment_id, body, query.kind),
  });

  environments.singleton("control").read({
    auth: true,
    summary: "Get sandbox control state",
    description: "Returns pause, cancellation and inspection state for worker coordination.",
    middleware: sandboxOnly,
    paramSchema: environmentParamsSchema,
    handler: ({ serviceContext, user, params }) =>
      getSandboxRunControlState({
        context: serviceContext,
        userId: user.id,
        runId: params.environment_id,
      }),
  });

  environments
    .sub("previews", "preview_id")
    .create({
      auth: true,
      summary: "Preview a sandbox service",
      description: "Creates short-lived access to a healthy declared sandbox service.",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      bodySchema: createSandboxPreviewRequestSchema,
      responses: { 409: { description: "Run or service is not previewable" } },
      handler: ({ serviceContext, user, params, body }) =>
        createSandboxPreview({
          context: serviceContext,
          runId: params.environment_id,
          serviceName: body.serviceName,
          userId: user.id,
        }),
    })
    .read({
      auth: true,
      summary: "Get a sandbox preview",
      middleware: sandboxOnly,
      paramSchema: environmentPreviewParamsSchema,
      handler: ({ serviceContext, user, params }) =>
        getSandboxPreview({
          context: serviceContext,
          previewId: params.preview_id,
          runId: params.environment_id,
          userId: user.id,
        }),
    })
    .delete({
      auth: true,
      summary: "Revoke a sandbox preview",
      middleware: sandboxOnly,
      paramSchema: environmentPreviewParamsSchema,
      handler: async ({ serviceContext, user, params }) => {
        await revokeSandboxPreview({
          context: serviceContext,
          previewId: params.preview_id,
          runId: params.environment_id,
          userId: user.id,
        });

        return { revoked: true };
      },
    });

  environments
    .sub("instructions", "instruction_id")
    .list({
      auth: true,
      summary: "List sandbox instructions",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      querySchema: listRunInstructionsQuerySchema,
      handler: async ({ serviceContext, user, params, query }) =>
        listPageOf(
          await listSandboxRunInstructionsForUser({
            context: serviceContext,
            userId: user.id,
            runId: params.environment_id,
            after: query.after,
          }),
          (envelope) => String(envelope.index),
        ),
    })
    .create({
      auth: true,
      summary: "Send an instruction to a running sandbox",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      bodySchema: submitRunInstructionSchema,
      responses: {
        409: { description: "Instruction conflicts with terminal or approval state" },
      },
      handler: ({ serviceContext, user, params, body }) =>
        requestSandboxRunInstruction({
          context: serviceContext,
          userId: user.id,
          runId: params.environment_id,
          kind: body.kind,
          idempotencyKey: body.idempotencyKey,
          content: body.content,
          command: body.command,
          requestId: body.requestId,
          approvalStatus: body.approvalStatus,
          serviceName: body.serviceName,
          serviceAction: body.serviceAction,
          timeoutSeconds: body.timeoutSeconds,
          escalateAfterSeconds: body.escalateAfterSeconds,
        }),
    });

  environments.sub("events", "event_id").list({
    auth: true,
    summary: "List sandbox events",
    middleware: sandboxOnly,
    paramSchema: environmentParamsSchema,
    querySchema: listRunInstructionsQuerySchema,
    handler: async ({ serviceContext, user, params, query }) =>
      listPageOf(
        await listSandboxRunEventsForUser({
          context: serviceContext,
          userId: user.id,
          runId: params.environment_id,
          after: query.after,
        }),
        (envelope) => String(envelope.index),
      ),
  });

  environments
    .singleton("goal")
    .read({
      auth: true,
      summary: "Get the goal a sandbox is working toward",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      handler: ({ serviceContext, params }) =>
        handleGetRunGoal(serviceContext, params.environment_id),
    })
    .create({
      auth: true,
      summary: "Set the goal for a sandbox",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      bodySchema: setGoalRequestSchema,
      handler: ({ serviceContext, params, body }) =>
        handleSetRunGoal(serviceContext, params.environment_id, body.objective),
    })
    .update({
      auth: true,
      summary: "Pause, resume or clear the sandbox goal",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      bodySchema: updateGoalRequestSchema,
      handler: ({ serviceContext, params, body }) =>
        handleUpdateRunGoal(serviceContext, params.environment_id, body),
    })
    .action("iterate", {
      auth: true,
      summary: "Record one unit of work against the sandbox goal",
      description: "Records progress and says whether the run should keep going.",
      middleware: sandboxOnly,
      paramSchema: environmentParamsSchema,
      bodySchema: recordGoalIterationRequestSchema,
      handler: ({ serviceContext, params, body }) =>
        handleRecordRunGoalIteration(serviceContext, params.environment_id, body),
    });

  environments.sub("usage_reports", "report_id").create({
    auth: true,
    summary: "Record measured sandbox usage",
    middleware: sandboxOnly,
    paramSchema: environmentParamsSchema,
    bodySchema: sandboxRunUsageReportSchema,
    handler: ({ serviceContext, user, params, body }) => {
      if (body.runId !== params.environment_id || !ownsResource(user.id, body.userId)) {
        throw new AssistantError("Usage report does not match the run", ErrorType.PARAMS_ERROR);
      }

      return recordSandboxRunUsage({
        context: serviceContext,
        userId: user.id,
        runId: params.environment_id,
        report: body,
      });
    },
  });

  environments
    .sub("runs", "run_id")
    .create({
      auth: true,
      summary: "Start a run on a machine",
      paramSchema: environmentParamsSchema,
      bodySchema: machineRunRequestSchema,
      handler: ({ serviceContext, params, body }) =>
        callMachineRun(serviceContext, params.environment_id, "/create", body),
    })
    .read({
      auth: true,
      summary: "Get a machine run",
      paramSchema: environmentRunParamsSchema,
      handler: ({ serviceContext, params }) =>
        callMachineRun(serviceContext, params.environment_id, `/read/${params.run_id}`),
    })
    .action("cancel", {
      auth: true,
      summary: "Cancel a machine run",
      paramSchema: environmentRunParamsSchema,
      handler: ({ serviceContext, params }) =>
        callMachineRun(serviceContext, params.environment_id, `/cancel/${params.run_id}`),
    });
});

export default app;
