import {
  createSandboxPreviewRequestSchema,
  listRunInstructionsQuerySchema,
  sandboxPreviewParamsSchema,
  sandboxRunParamsSchema,
  sandboxRunDetailSchema,
  sandboxRunUsageReportSchema,
  recordGoalIterationRequestSchema,
  setGoalRequestSchema,
  submitRunInstructionSchema,
  updateGoalRequestSchema,
  updateSandboxRunControlSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  createSandboxPreview,
  getSandboxPreview,
  revokeSandboxPreview,
} from "~/services/apps/sandbox/previews";
import {
  getSandboxRunControlState,
  getSandboxRunRecordForUser,
  listSandboxRunEventsForUser,
  listSandboxRunInstructionsForUser,
  requestSandboxRunControlAction,
  requestSandboxRunInstruction,
} from "~/services/apps/sandbox/runs";
import { recordSandboxRunUsage } from "~/services/apps/sandbox/usage";
import {
  handleGetRunGoal,
  handleRecordRunGoalIteration,
  handleSetRunGoal,
  handleUpdateRunGoal,
} from "~/services/completions/conversationGoal";
import { AssistantError, ErrorType } from "~/utils/errors";

export function registerSandboxRunLifecycleRoutes(app: Hono): void {
  addRoute(app, "get", "/runs/:runId", {
    tags: ["apps"],
    description: "Get an authorised sandbox run for compact remote presentation",
    auth: true,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Sandbox run detail", schema: sandboxRunDetailSchema },
      404: { description: "Sandbox run not found" },
    },
    handler: async ({ params, serviceContext, user }) => {
      const record = await getSandboxRunRecordForUser({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
      });

      return {
        run: record.run,
        createdByUserId: record.createdByUserId,
        projectId: record.projectId,
        conversationId: record.conversationId,
      };
    },
  });

  addRoute(app, "post", "/runs/:runId/previews", {
    tags: ["apps"],
    description: "Create short-lived access to a healthy declared sandbox service",
    auth: true,
    bodySchema: createSandboxPreviewRequestSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Sandbox preview access created" },
      409: { description: "Run or service is not previewable" },
    },
    handler: async ({ body, params, serviceContext, user }) =>
      createSandboxPreview({
        context: serviceContext,
        runId: params.runId,
        serviceName: body.serviceName,
        userId: user.id,
      }),
  });

  addRoute(app, "get", "/runs/:runId/previews/:previewId", {
    tags: ["apps"],
    description: "Get the current state of a sandbox preview",
    auth: true,
    paramSchema: sandboxPreviewParamsSchema,
    responses: {
      200: { description: "Current sandbox preview state" },
      404: { description: "Sandbox preview not found" },
    },
    handler: async ({ params, serviceContext, user }) =>
      getSandboxPreview({
        context: serviceContext,
        previewId: params.previewId,
        runId: params.runId,
        userId: user.id,
      }),
  });

  addRoute(app, "delete", "/runs/:runId/previews/:previewId", {
    tags: ["apps"],
    description: "Revoke a sandbox preview",
    auth: true,
    paramSchema: sandboxPreviewParamsSchema,
    responses: {
      200: { description: "Sandbox preview revoked" },
      404: { description: "Sandbox preview not found" },
    },
    handler: async ({ params, serviceContext, user }) => {
      await revokeSandboxPreview({
        context: serviceContext,
        previewId: params.previewId,
        runId: params.runId,
        userId: user.id,
      });

      return { revoked: true };
    },
  });

  addRoute(app, "get", "/runs/:runId/goal", {
    tags: ["apps"],
    description: "Get the goal a sandbox run is working toward",
    auth: true,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "The run goal, or null" },
    },
    handler: async ({ params, serviceContext }) => handleGetRunGoal(serviceContext, params.runId),
  });

  addRoute(app, "post", "/runs/:runId/goal", {
    tags: ["apps"],
    description: "Set the goal for a sandbox run",
    auth: true,
    bodySchema: setGoalRequestSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "The stored run goal" },
    },
    handler: async ({ body, params, serviceContext }) =>
      handleSetRunGoal(serviceContext, params.runId, body.objective),
  });

  addRoute(app, "post", "/runs/:runId/goal/iteration", {
    tags: ["apps"],
    description:
      "Record one unit of work against a run goal and learn whether the run should keep going",
    auth: true,
    bodySchema: recordGoalIterationRequestSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "The updated run goal and the continuation decision" },
    },
    handler: async ({ body, params, serviceContext }) =>
      handleRecordRunGoalIteration(serviceContext, params.runId, body),
  });

  addRoute(app, "patch", "/runs/:runId/goal", {
    tags: ["apps"],
    description: "Pause, resume, or clear the goal for a sandbox run",
    auth: true,
    bodySchema: updateGoalRequestSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "The updated run goal" },
    },
    handler: async ({ body, params, serviceContext }) =>
      handleUpdateRunGoal(serviceContext, params.runId, body),
  });

  addRoute(app, "get", "/runs/:runId/instructions", {
    tags: ["apps"],
    auth: true,
    paramSchema: sandboxRunParamsSchema,
    querySchema: listRunInstructionsQuerySchema,
    handler: async ({ params, query, serviceContext, user }) => {
      const instructions = await listSandboxRunInstructionsForUser({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
        after: query.after,
      });

      return { instructions };
    },
  });

  addRoute(app, "get", "/runs/:runId/events", {
    tags: ["apps"],
    auth: true,
    paramSchema: sandboxRunParamsSchema,
    querySchema: listRunInstructionsQuerySchema,
    handler: async ({ params, query, serviceContext, user }) => {
      const events = await listSandboxRunEventsForUser({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
        after: query.after,
      });

      return { events };
    },
  });

  addRoute(app, "post", "/runs/:runId/instructions", {
    tags: ["apps"],
    description: "Submit an operator instruction to a running sandbox run",
    auth: true,
    bodySchema: submitRunInstructionSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Instruction accepted" },
      409: { description: "Instruction conflicts with terminal or approval state" },
    },
    handler: async ({ body, params, serviceContext, user }) => {
      const instruction = await requestSandboxRunInstruction({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
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
      });

      return { instruction };
    },
  });

  addRoute(app, "post", "/runs/:runId/usage", {
    tags: ["apps"],
    description: "Record the measured container usage for a finished sandbox run",
    auth: true,
    bodySchema: sandboxRunUsageReportSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Usage recorded" },
    },
    handler: async ({ body, params, serviceContext, user }) => {
      if (body.runId !== params.runId) {
        throw new AssistantError("Usage report does not match the run", ErrorType.PARAMS_ERROR);
      }

      if (body.userId !== user.id) {
        throw new AssistantError("Usage report does not match the run", ErrorType.PARAMS_ERROR);
      }

      return recordSandboxRunUsage({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
        report: body,
      });
    },
  });

  addRoute(app, "get", "/runs/:runId/control", {
    tags: ["apps"],
    description: "Get run execution control state for worker coordination",
    auth: true,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Sandbox run control state" },
    },
    handler: async ({ params, serviceContext, user }) =>
      getSandboxRunControlState({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
      }),
  });

  addRoute(app, "patch", "/runs/:runId/control", {
    tags: ["apps"],
    description: "Pause, resume, or cancel a sandbox run at a safe execution boundary",
    auth: true,
    bodySchema: updateSandboxRunControlSchema,
    paramSchema: sandboxRunParamsSchema,
    responses: {
      200: { description: "Updated sandbox run control state" },
      409: { description: "Run state changed or action is no longer valid" },
    },
    handler: async ({ body, params, serviceContext, user }) =>
      requestSandboxRunControlAction({
        context: serviceContext,
        userId: user.id,
        runId: params.runId,
        input: body,
      }),
  });
}
