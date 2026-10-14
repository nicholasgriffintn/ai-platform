import {
  acceptWorkspaceInvitationSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema,
  transferWorkspaceOwnershipSchema,
  updateWorkspaceMemberSchema,
  updateWorkspaceSchema,
  workspaceAuditListQuerySchema,
  workspaceAuditListResponseSchema,
  workspaceDetailSchema,
  workspaceInvitationDeliverySchema,
  workspaceListResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { listWorkspaceAudit } from "~/modules/audit/application";
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  inviteWorkspaceMember,
  leaveWorkspace,
  listWorkspaces,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  transferWorkspaceOwnership,
  updateWorkspace,
  updateWorkspaceMember,
} from "~/modules/workspaces/application";

const app = new Hono();
const workspaceParamsSchema = z.object({ workspace_id: z.string().min(1) });
const memberParamsSchema = workspaceParamsSchema.extend({
  member_id: z.coerce.number().int().positive(),
});

defineResource(app, { idParam: "workspace_id", tags: ["workspaces"] }, (workspaces) => {
  workspaces
    .list({
      auth: true,
      summary: "List the caller's workspaces",
      responses: { 200: { description: "Workspaces", schema: workspaceListResponseSchema } },
      handler: ({ serviceContext }) => listWorkspaces(serviceContext),
    })
    .create({
      auth: true,
      summary: "Create a workspace",
      bodySchema: createWorkspaceSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, body }) => createWorkspace(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Get a workspace",
      paramSchema: workspaceParamsSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, params }) => getWorkspace(serviceContext, params.workspace_id),
    })
    .update({
      auth: true,
      summary: "Update a workspace",
      paramSchema: workspaceParamsSchema,
      bodySchema: updateWorkspaceSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateWorkspace(serviceContext, params.workspace_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a workspace",
      paramSchema: workspaceParamsSchema,
      handler: ({ serviceContext, params }) => deleteWorkspace(serviceContext, params.workspace_id),
    })
    .action("leave", {
      auth: true,
      summary: "Leave a workspace",
      paramSchema: workspaceParamsSchema,
      handler: ({ serviceContext, params }) => leaveWorkspace(serviceContext, params.workspace_id),
    })
    .action("transfer_ownership", {
      auth: true,
      summary: "Transfer workspace ownership",
      paramSchema: workspaceParamsSchema,
      bodySchema: transferWorkspaceOwnershipSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, params, body }) =>
        transferWorkspaceOwnership(serviceContext, params.workspace_id, body.newOwnerUserId),
    });

  workspaces.sub("audit", "record_id").list({
    auth: true,
    summary: "List workspace audit records",
    paramSchema: workspaceParamsSchema,
    querySchema: workspaceAuditListQuerySchema,
    responses: { 200: { description: "Audit records", schema: workspaceAuditListResponseSchema } },
    handler: ({ serviceContext, params, query }) =>
      listWorkspaceAudit(serviceContext, params.workspace_id, query),
  });

  workspaces
    .sub("invitations", "invitation_id")
    .create({
      auth: true,
      summary: "Invite a workspace member",
      paramSchema: workspaceParamsSchema,
      bodySchema: createWorkspaceInvitationSchema,
      responses: {
        200: { description: "Single-use invitation", schema: workspaceInvitationDeliverySchema },
      },
      handler: ({ serviceContext, params, body }) =>
        inviteWorkspaceMember(serviceContext, params.workspace_id, body),
    })
    .delete({
      auth: true,
      summary: "Revoke a workspace invitation",
      paramSchema: workspaceParamsSchema.extend({ invitation_id: z.string().min(1) }),
      handler: ({ serviceContext, params }) =>
        revokeWorkspaceInvitation(serviceContext, params.workspace_id, params.invitation_id),
    });

  workspaces.collection("invitations", "invitation_id").collectionAction("accept", {
    auth: true,
    summary: "Accept a workspace invitation",
    description: "The invitation token identifies the workspace.",
    bodySchema: acceptWorkspaceInvitationSchema,
    responses: { 200: { description: "The joined workspace", schema: workspaceDetailSchema } },
    handler: ({ serviceContext, body }) => acceptWorkspaceInvitation(serviceContext, body.token),
  });

  workspaces
    .sub("members", "member_id")
    .update({
      auth: true,
      summary: "Change a member's role",
      paramSchema: memberParamsSchema,
      bodySchema: updateWorkspaceMemberSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateWorkspaceMember(serviceContext, params.workspace_id, params.member_id, body.role),
    })
    .delete({
      auth: true,
      summary: "Remove a workspace member",
      paramSchema: memberParamsSchema,
      responses: { 200: { description: "The workspace", schema: workspaceDetailSchema } },
      handler: ({ serviceContext, params }) =>
        removeWorkspaceMember(serviceContext, params.workspace_id, params.member_id),
    });
});

export default app;
