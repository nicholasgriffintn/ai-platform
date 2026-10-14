import {
  approvalListSchema,
  approvalParamsSchema,
  approvalSchema,
  createStandingApprovalSchema,
  errorResponseSchema,
  listApprovalsQuerySchema,
  resolveApprovalSchema,
  standingApprovalListSchema,
  standingApprovalParamsSchema,
  standingApprovalSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { defineResource } from "~/infrastructure/http/resource";

import { listApprovals, readApproval, resolveApproval } from "../application/approvals";
import {
  grantPolyStandingApproval,
  listPolyStandingApprovals,
  revokePolyStandingApproval,
} from "../application/standing";

const app = new Hono();

defineResource(app, { idParam: "approval_id", tags: ["approvals"] }, (approvals) => {
  approvals
    .list({
      auth: true,
      summary: "List pending approvals",
      description:
        "Connector operations, task questions and task tool approvals waiting on the caller, newest first.",
      querySchema: listApprovalsQuerySchema,
      responses: { 200: { description: "Pending approvals", schema: approvalListSchema } },
      handler: ({ serviceContext, query }) => listApprovals(serviceContext, query),
    })
    .read({
      auth: true,
      summary: "Get an approval",
      paramSchema: approvalParamsSchema,
      responses: {
        200: { description: "The approval", schema: approvalSchema },
        404: { description: "Approval not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params }) => readApproval(serviceContext, params.approval_id),
    })
    .update({
      auth: true,
      summary: "Approve or reject",
      description:
        "Resolves a connector operation approval. Task questions and tool approvals are answered through the response input.",
      paramSchema: approvalParamsSchema,
      bodySchema: resolveApprovalSchema,
      responses: {
        200: { description: "The resolved approval", schema: approvalSchema },
        409: { description: "Answer through the response input", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params, body }) =>
        resolveApproval(serviceContext, params.approval_id, body.state),
    });

  approvals
    .collection("standing", "standing_approval_id")
    .list({
      auth: true,
      summary: "List standing approvals",
      description: "Actions Poly may take without asking, for one tool and destination each.",
      responses: { 200: { description: "Standing approvals", schema: standingApprovalListSchema } },
      handler: ({ serviceContext }) => listPolyStandingApprovals(serviceContext),
    })
    .create({
      auth: true,
      summary: "Always allow a waiting action here",
      description:
        "Approves the write Poly is waiting on for the next thirty days, for that tool and destination only.",
      bodySchema: createStandingApprovalSchema,
      responses: {
        200: { description: "The standing approval", schema: standingApprovalSchema },
        400: {
          description: "The action cannot be allowed ahead of time",
          schema: errorResponseSchema,
        },
        409: { description: "The approval is no longer waiting", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, body }) =>
        grantPolyStandingApproval(serviceContext, body.interaction_id),
    })
    .delete({
      auth: true,
      summary: "Stop allowing an action ahead of time",
      paramSchema: standingApprovalParamsSchema,
      responses: {
        404: { description: "Standing approval not found", schema: errorResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        revokePolyStandingApproval(serviceContext, params.standing_approval_id),
    });
});

export default app;
