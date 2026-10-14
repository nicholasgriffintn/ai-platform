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
  environmentSchema,
  errorResponseSchema,
  listEnvironmentsQuerySchema,
  listPageOf,
  listRunInstructionsQuerySchema,
  recordGoalIterationRequestSchema,
  sandboxRunUsageReportSchema,
  submitRunInstructionSchema,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";
import { requirePlan } from "~/middleware/requirePlan";
import { getComputerUseAvailability } from "~/modules/computer-use/application/access";
import { handleRecordRunGoalIteration } from "~/modules/conversations/application/conversationGoal";
import {
  createSandboxPreview,
  getSandboxPreview,
  revokeSandboxPreview,
} from "~/modules/sandbox/application/previews";
import {
  getSandboxRunControlState,
  listSandboxRunEventsForUser,
  listSandboxRunInstructionsForUser,
  requestSandboxRunInstruction,
} from "~/modules/sandbox/application/runs";
import { recordSandboxRunUsage } from "~/modules/sandbox/application/usage";

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

  environments.singleton("goal").action("iterate", {
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
});

export default app;
