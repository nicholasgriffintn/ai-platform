import {
  acceptWorkspaceInvitationSchema,
  approveSetupPlanSchema,
  createInitiativeSchema,
  createWorkspaceInvitationSchema,
  createWorkspaceSchema,
  decideHireSchema,
  initiativeListResponseSchema,
  initiativeSchema,
  onboardingStateSchema,
  proposeHireSchema,
  setupPlanStateSchema,
  startOnboardingSchema,
  transferWorkspaceOwnershipSchema,
  updateInitiativeSchema,
  updateSetupPlanSchema,
  updateWorkspaceMemberSchema,
  updateWorkspaceSchema,
  updateWorkspaceTeammateSchema,
  workCostsQuerySchema,
  workCostsResponseSchema,
  workRailsQuerySchema,
  workRailsResponseSchema,
  workspaceAuditListQuerySchema,
  workspaceAuditListResponseSchema,
  workspaceDetailSchema,
  workspaceInvitationDeliverySchema,
  workspaceListResponseSchema,
  workspaceTeamDirectoryResponseSchema,
  workspaceTeammateSchema,
  workspaceTeamResponseSchema,
  workTaskListResponseSchema,
  workTaskQuerySchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { listWorkspaceWorkTasks } from "~/modules/project-tasks/application/listing";
import { getWorkspaceTeamDirectory } from "~/modules/teammates/application/directory";
import {
  decideHire,
  getWorkspaceTeam,
  proposeHire,
  updateWorkspaceTeammate,
} from "~/modules/teammates/application/organisation";
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
import { listWorkspaceAudit } from "~/modules/workspaces/application/audit";
import {
  createInitiative,
  deleteInitiative,
  listInitiatives,
  updateInitiative,
} from "~/modules/workspaces/application/initiatives";
import {
  approveSetupPlan,
  archiveSetup,
  getOnboarding,
  reviseSetupPlan,
  startOnboarding,
  startWorkspaceSetup,
} from "~/modules/workspaces/application/onboarding";
import { getWorkCosts, getWorkRails } from "~/modules/workspaces/application/work-insights";

const app = new Hono();
const workspaceParamsSchema = z.object({ workspace_id: z.string().min(1) });
const memberParamsSchema = workspaceParamsSchema.extend({
  member_id: z.coerce.number().int().positive(),
});
const teammateParamsSchema = workspaceParamsSchema.extend({ teammate_id: z.string().min(1) });
const initiativeParamsSchema = workspaceParamsSchema.extend({ initiative_id: z.string().min(1) });

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

  workspaces.singleton("team").read({
    auth: true,
    summary: "List the workspace team",
    description: "Teammates employed by the workspace, with reporting lines, wake rules and spend.",
    paramSchema: workspaceParamsSchema,
    responses: { 200: { description: "The team", schema: workspaceTeamResponseSchema } },
    handler: ({ serviceContext, params }) => getWorkspaceTeam(serviceContext, params.workspace_id),
  });

  workspaces.singleton("team_directory").read({
    auth: true,
    summary: "List the workspace team by name",
    description: "A light list of the team for naming owners and reviewers, without spend.",
    paramSchema: workspaceParamsSchema,
    responses: {
      200: { description: "The team directory", schema: workspaceTeamDirectoryResponseSchema },
    },
    handler: ({ serviceContext, params }) =>
      getWorkspaceTeamDirectory(serviceContext, params.workspace_id),
  });

  workspaces
    .sub("team", "teammate_id")
    .update({
      auth: true,
      summary: "Change a teammate's place on the team",
      paramSchema: teammateParamsSchema,
      bodySchema: updateWorkspaceTeammateSchema,
      responses: { 200: { description: "The teammate", schema: workspaceTeammateSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateWorkspaceTeammate(serviceContext, params.workspace_id, params.teammate_id, body),
    })
    .action("decision", {
      auth: true,
      summary: "Approve or reject a proposed hire",
      paramSchema: teammateParamsSchema,
      bodySchema: decideHireSchema,
      responses: { 200: { description: "The team", schema: workspaceTeamResponseSchema } },
      handler: ({ serviceContext, params, body }) =>
        decideHire(serviceContext, params.workspace_id, params.teammate_id, body.decision),
    });

  workspaces.sub("hires", "hire_id").create({
    auth: true,
    summary: "Propose a hire",
    description: "Creates the teammate as proposed. An owner or admin approves it before it works.",
    paramSchema: workspaceParamsSchema,
    bodySchema: proposeHireSchema,
    responses: { 200: { description: "The proposed teammate", schema: workspaceTeammateSchema } },
    handler: ({ serviceContext, params, body }) =>
      proposeHire(serviceContext, params.workspace_id, body, { teammateId: null }),
  });

  workspaces.singleton("initiatives").read({
    auth: true,
    summary: "List the mission and initiatives",
    paramSchema: workspaceParamsSchema,
    responses: { 200: { description: "Initiatives", schema: initiativeListResponseSchema } },
    handler: ({ serviceContext, params }) => listInitiatives(serviceContext, params.workspace_id),
  });

  workspaces
    .sub("initiatives", "initiative_id")
    .create({
      auth: true,
      summary: "Create an initiative",
      paramSchema: workspaceParamsSchema,
      bodySchema: createInitiativeSchema,
      responses: { 200: { description: "The initiative", schema: initiativeSchema } },
      handler: ({ serviceContext, params, body }) =>
        createInitiative(serviceContext, params.workspace_id, body),
    })
    .update({
      auth: true,
      summary: "Update an initiative",
      paramSchema: initiativeParamsSchema,
      bodySchema: updateInitiativeSchema,
      responses: { 200: { description: "The initiative", schema: initiativeSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateInitiative(serviceContext, params.workspace_id, params.initiative_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete an initiative",
      paramSchema: initiativeParamsSchema,
      handler: ({ serviceContext, params }) =>
        deleteInitiative(serviceContext, params.workspace_id, params.initiative_id),
    });

  workspaces.singleton("tasks").read({
    auth: true,
    summary: "List open work across the workspace",
    description: "Filter by teammate to see what it owns or is reviewing.",
    paramSchema: workspaceParamsSchema,
    querySchema: workTaskQuerySchema,
    responses: { 200: { description: "Tasks", schema: workTaskListResponseSchema } },
    handler: ({ serviceContext, params, query }) =>
      listWorkspaceWorkTasks(serviceContext, params.workspace_id, {
        ownerTeammateId: query.owner_teammate_id,
        includeDone: query.include_done,
      }),
  });

  workspaces.singleton("costs").read({
    auth: true,
    summary: "Read a month's spend by teammate, initiative, project and task",
    paramSchema: workspaceParamsSchema,
    querySchema: workCostsQuerySchema,
    responses: { 200: { description: "Spend", schema: workCostsResponseSchema } },
    handler: ({ serviceContext, params, query }) =>
      getWorkCosts(serviceContext, params.workspace_id, query.period),
  });

  workspaces.singleton("rails").read({
    auth: true,
    summary: "Read teammate heartbeat rails",
    paramSchema: workspaceParamsSchema,
    querySchema: workRailsQuerySchema,
    responses: { 200: { description: "Rails", schema: workRailsResponseSchema } },
    handler: ({ serviceContext, params, query }) =>
      getWorkRails(serviceContext, params.workspace_id, query.hours),
  });

  workspaces
    .singleton("setup")
    .read({
      auth: true,
      summary: "Read the workspace setup",
      paramSchema: workspaceParamsSchema,
      responses: { 200: { description: "Setup", schema: onboardingStateSchema } },
      handler: ({ serviceContext, params }) => getOnboarding(serviceContext, params.workspace_id),
    })
    .create({
      auth: true,
      summary: "Hire a lead and start setup",
      description: "For an existing workspace without a lead.",
      paramSchema: workspaceParamsSchema,
      responses: { 200: { description: "Setup", schema: onboardingStateSchema } },
      handler: ({ serviceContext, params }) =>
        startWorkspaceSetup(serviceContext, params.workspace_id),
    })
    .update({
      auth: true,
      summary: "Edit the setup plan",
      description: "Creates a new revision and clears any approval.",
      paramSchema: workspaceParamsSchema,
      bodySchema: updateSetupPlanSchema,
      responses: { 200: { description: "Setup plan", schema: setupPlanStateSchema } },
      handler: ({ serviceContext, params, body }) =>
        reviseSetupPlan(serviceContext, params.workspace_id, body.plan, body.expectedRevision),
    })
    .action("approve", {
      auth: true,
      summary: "Approve the setup plan and start the workspace",
      paramSchema: workspaceParamsSchema,
      bodySchema: approveSetupPlanSchema,
      responses: { 200: { description: "Setup plan", schema: setupPlanStateSchema } },
      handler: ({ serviceContext, params, body }) =>
        approveSetupPlan(serviceContext, params.workspace_id, body.revision),
    })
    .action("archive", {
      auth: true,
      summary: "Undo what the setup plan created",
      paramSchema: workspaceParamsSchema,
      handler: ({ serviceContext, params }) => archiveSetup(serviceContext, params.workspace_id),
    });

  workspaces.collection("onboarding", "onboarding_id").collectionAction("start", {
    auth: true,
    summary: "Create a workspace with a lead",
    description:
      "Creates the workspace, hires a lead and opens the setup task. The lead proposes a setup plan for approval.",
    bodySchema: startOnboardingSchema,
    responses: { 200: { description: "Setup", schema: onboardingStateSchema } },
    handler: ({ serviceContext, body }) => startOnboarding(serviceContext, body),
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
