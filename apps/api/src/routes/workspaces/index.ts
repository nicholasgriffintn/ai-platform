import {
  usageSummaryQuerySchema,
  workspaceUsageSummaryResponseSchema,
  createProjectSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema,
  projectDetailSchema,
  projectTaskAttentionResponseSchema,
  updateWorkspaceSchema,
  updateWorkspaceMemberSchema,
  transferWorkspaceOwnershipSchema,
  workspaceDetailSchema,
  workspaceInvitationDeliverySchema,
  workspaceListResponseSchema,
  workAttentionQuerySchema,
  workAttentionResponseSchema,
  workspaceAuditListQuerySchema,
  workspaceAuditListResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { listWorkAttention } from "~/services/attention";
import { listWorkspaceAudit } from "~/services/audit";
import { listProjectTaskAttention } from "~/services/project-tasks";
import {
  createProject,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  inviteWorkspaceMember,
  listWorkspaces,
  revokeWorkspaceInvitation,
  leaveWorkspace,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
  updateWorkspaceMember,
  updateWorkspace,
} from "~/services/workspaces";
import { getWorkspaceUsageSummary } from "~/services/workspaces/usage";

const app = new Hono();
const workspaceParams = z.object({ workspaceId: z.string().min(1) });
const workspaceMemberParams = workspaceParams.extend({
  userId: z.coerce.number().int().positive(),
});

addRoute(app, "get", "/", {
  auth: true,
  tags: ["workspaces"],
  summary: "List the signed-in user's workspaces",
  responses: { 200: { description: "Workspace list", schema: workspaceListResponseSchema } },
  handler: ({ serviceContext }) => listWorkspaces(serviceContext),
});

addRoute(app, "post", "/", {
  auth: true,
  tags: ["workspaces"],
  summary: "Create a workspace",
  bodySchema: createWorkspaceSchema,
  responses: { 200: { description: "Created workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, body }) => createWorkspace(serviceContext, body),
});

addRoute(app, "get", "/attention", {
  auth: true,
  tags: ["workspaces", "attention"],
  summary: "List operational work across the signed-in user's workspaces",
  description:
    "Derives filtered task interactions and sandbox run states through current membership.",
  querySchema: workAttentionQuerySchema,
  responses: {
    200: {
      description: "Filtered operational work",
      schema: workAttentionResponseSchema,
    },
  },
  handler: ({ serviceContext, query }) => listWorkAttention(serviceContext, query),
});

addRoute(app, "get", "/attention/tasks", {
  auth: true,
  tags: ["workspaces", "tasks"],
  summary: "List tasks waiting on the signed-in user",
  querySchema: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }),
  responses: {
    200: { description: "Tasks waiting on you", schema: projectTaskAttentionResponseSchema },
  },
  handler: ({ serviceContext, query }) =>
    listProjectTaskAttention(serviceContext, { limit: query.limit }),
});

addRoute(app, "get", "/:workspaceId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Get a workspace",
  paramSchema: workspaceParams,
  responses: { 200: { description: "Workspace details", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, params }) => getWorkspace(serviceContext, params.workspaceId),
});

addRoute(app, "get", "/:workspaceId/usage", {
  auth: true,
  tags: ["workspaces"],
  summary: "Summarise recorded workspace spend for an owner or administrator",
  paramSchema: workspaceParams,
  querySchema: usageSummaryQuerySchema,
  responses: {
    200: { description: "Attributed workspace usage", schema: workspaceUsageSummaryResponseSchema },
  },
  handler: ({ serviceContext, params, query }) =>
    getWorkspaceUsageSummary(serviceContext, params.workspaceId, query),
});

addRoute(app, "get", "/:workspaceId/audit", {
  auth: true,
  tags: ["workspaces"],
  summary: "List workspace audit records",
  paramSchema: workspaceParams,
  querySchema: workspaceAuditListQuerySchema,
  responses: {
    200: { description: "Workspace audit records", schema: workspaceAuditListResponseSchema },
  },
  handler: ({ serviceContext, params, query }) =>
    listWorkspaceAudit(serviceContext, params.workspaceId, query),
});

addRoute(app, "put", "/:workspaceId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Update a workspace",
  paramSchema: workspaceParams,
  bodySchema: updateWorkspaceSchema,
  responses: { 200: { description: "Updated workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateWorkspace(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", "/:workspaceId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Delete a workspace",
  paramSchema: workspaceParams,
  handler: ({ serviceContext, params }) => deleteWorkspace(serviceContext, params.workspaceId),
});

addRoute(app, "post", "/:workspaceId/invitations", {
  auth: true,
  tags: ["workspaces"],
  summary: "Invite a workspace member",
  paramSchema: workspaceParams,
  bodySchema: createWorkspaceInvitationSchema,
  responses: {
    200: { description: "Secure single-use invitation", schema: workspaceInvitationDeliverySchema },
  },
  handler: ({ serviceContext, params, body }) =>
    inviteWorkspaceMember(serviceContext, params.workspaceId, body),
});

addRoute(app, "delete", "/:workspaceId/invitations/:invitationId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Revoke a workspace invitation",
  paramSchema: workspaceParams.extend({ invitationId: z.string().min(1) }),
  handler: ({ serviceContext, params }) =>
    revokeWorkspaceInvitation(serviceContext, params.workspaceId, params.invitationId),
});

addRoute(app, "put", "/:workspaceId/members/:userId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Change a workspace member role",
  paramSchema: workspaceMemberParams,
  bodySchema: updateWorkspaceMemberSchema,
  responses: { 200: { description: "Updated workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    updateWorkspaceMember(serviceContext, params.workspaceId, params.userId, body.role),
});

addRoute(app, "delete", "/:workspaceId/members/:userId", {
  auth: true,
  tags: ["workspaces"],
  summary: "Remove a workspace member",
  paramSchema: workspaceMemberParams,
  responses: { 200: { description: "Updated workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, params }) =>
    removeWorkspaceMember(serviceContext, params.workspaceId, params.userId),
});

addRoute(app, "post", "/:workspaceId/leave", {
  auth: true,
  tags: ["workspaces"],
  summary: "Leave a workspace",
  paramSchema: workspaceParams,
  handler: ({ serviceContext, params }) => leaveWorkspace(serviceContext, params.workspaceId),
});

addRoute(app, "post", "/:workspaceId/transfer-ownership", {
  auth: true,
  tags: ["workspaces"],
  summary: "Transfer workspace ownership",
  paramSchema: workspaceParams,
  bodySchema: transferWorkspaceOwnershipSchema,
  responses: { 200: { description: "Updated workspace", schema: workspaceDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    transferWorkspaceOwnership(serviceContext, params.workspaceId, body.newOwnerUserId),
});

addRoute(app, "post", "/:workspaceId/projects", {
  auth: true,
  tags: ["projects"],
  summary: "Create a project inside a workspace",
  paramSchema: workspaceParams,
  bodySchema: createProjectSchema,
  responses: { 200: { description: "Created project", schema: projectDetailSchema } },
  handler: ({ serviceContext, params, body }) =>
    createProject(serviceContext, params.workspaceId, body),
});

export default app;
