import {
  createTeammateSchema,
  ensureTeammateContextSchema,
  hireTeammateSchema,
  listPageOf,
  publishTeammateToWorkspaceSchema,
  recordTeammateFeedbackSchema,
  teammateConnectionGrantListResponseSchema,
  teammateConnectionGrantSchema,
  teammateContextSchema,
  teammateResponseSchema,
  updateTeammateContextAutonomySchema,
  updateTeammateContextPauseSchema,
  updateTeammateContextStatusSchema,
  updateTeammateContextToolRulesSchema,
  updateTeammateSchema,
  upsertTeammateConnectionGrantSchema,
  type TeammateContext,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createTeammate,
  deleteTeammate,
  ensureTeammateContext,
  getTeammateById,
  getUserTeammates,
  hireTeammate,
  listTeammateConnectionGrants,
  listTeammateContexts,
  publishTeammateToWorkspace,
  recordTeammateFeedback,
  removeInheritedTeammateFromProject,
  restoreInheritedTeammateToProject,
  updateTeammate,
  updateTeammateContextAutonomy,
  updateTeammateContextPause,
  updateTeammateContextStatus,
  updateTeammateContextToolRules,
  upsertTeammateConnectionGrant,
} from "~/modules/teammates/application";
import type { IEnv } from "~/types";

import { defineMarketplace } from "./marketplace";

const app = new Hono<{ Bindings: IEnv }>();
const teammateParamsSchema = z.object({ teammate_id: z.string().min(1) });
const teammateProjectParamsSchema = teammateParamsSchema.extend({
  project_id: z.string().min(1),
});
const contextParamsSchema = z.object({ context_id: z.string().min(1) });
const updateTeammateProjectSchema = z.object({ removed: z.boolean() });
const updateTeammateContextSchema = updateTeammateContextStatusSchema
  .partial()
  .extend(updateTeammateContextAutonomySchema.partial().shape)
  .extend(updateTeammateContextToolRulesSchema.partial().shape)
  .extend(updateTeammateContextPauseSchema.partial().shape)
  .refine(
    (body) =>
      body.status !== undefined ||
      body.autonomyLevel !== undefined ||
      body.toolRules !== undefined ||
      body.pausedUntil !== undefined,
    { message: "Change the status, autonomy level, tool rules or pause" },
  );

defineMarketplace(app);

defineResource(app, { idParam: "teammate_id", tags: ["teammates"] }, (teammates) => {
  teammates
    .list({
      auth: true,
      summary: "List teammates",
      handler: async ({ serviceContext }) =>
        listPageOf(await getUserTeammates(serviceContext), (teammate) => teammate.id),
    })
    .create({
      auth: true,
      summary: "Create a teammate",
      bodySchema: createTeammateSchema,
      responses: { 200: { description: "The teammate", schema: teammateResponseSchema } },
      handler: ({ serviceContext, body }) => createTeammate(serviceContext, body),
    })
    .collectionAction("hire", {
      auth: true,
      summary: "Hire a teammate",
      description:
        "Creates a teammate from a built-in role, a job description, or both. The role supplies the brief, suggested tools and kind.",
      bodySchema: hireTeammateSchema,
      handler: ({ serviceContext, body }) => hireTeammate(serviceContext, body),
    })
    .read({
      auth: true,
      summary: "Get a teammate",
      paramSchema: teammateParamsSchema,
      responses: { 200: { description: "The teammate", schema: teammateResponseSchema } },
      handler: ({ serviceContext, params }) => getTeammateById(serviceContext, params.teammate_id),
    })
    .update({
      auth: true,
      summary: "Update a teammate",
      paramSchema: teammateParamsSchema,
      bodySchema: updateTeammateSchema,
      responses: { 200: { description: "The teammate", schema: teammateResponseSchema } },
      handler: ({ serviceContext, params, body }) =>
        updateTeammate(serviceContext, params.teammate_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a teammate",
      paramSchema: teammateParamsSchema,
      handler: async ({ serviceContext, params }) => {
        await deleteTeammate(serviceContext, params.teammate_id);

        return { deleted: true };
      },
    })
    .action("feedback", {
      auth: true,
      summary: "Say whether a teammate got it right",
      description:
        "One verdict per person per conversation builds the teammate's scorecard. Saying it again replaces the earlier verdict.",
      paramSchema: teammateParamsSchema,
      bodySchema: recordTeammateFeedbackSchema,
      handler: async ({ serviceContext, params, body }) => {
        await recordTeammateFeedback(serviceContext, params.teammate_id, body);

        return { recorded: true };
      },
    })
    .action("publish", {
      auth: true,
      summary: "Publish a teammate to a workspace",
      description:
        "Copies a personal teammate into a workspace so the workspace owns it, keeping a link back to the source.",
      paramSchema: teammateParamsSchema,
      bodySchema: publishTeammateToWorkspaceSchema,
      handler: ({ serviceContext, params, body }) =>
        publishTeammateToWorkspace(serviceContext, params.teammate_id, body.workspace_id),
    });

  teammates.sub("projects", "project_id").update({
    auth: true,
    summary: "Remove or restore a workspace teammate in one project",
    description:
      "Workspace defaults reach every project. Setting removed records that one project does not want this teammate, without removing it from the workspace.",
    paramSchema: teammateProjectParamsSchema,
    bodySchema: updateTeammateProjectSchema,
    handler: async ({ serviceContext, params, body }) => {
      await (body.removed ? removeInheritedTeammateFromProject : restoreInheritedTeammateToProject)(
        serviceContext,
        params.project_id,
        params.teammate_id,
      );

      return { removed: body.removed };
    },
  });

  teammates
    .sub("contexts", "context_id")
    .list({
      auth: true,
      summary: "List a teammate's scoped contexts",
      paramSchema: teammateParamsSchema,
      handler: async ({ serviceContext, params }) =>
        listPageOf(
          (await listTeammateContexts(serviceContext, params.teammate_id)).contexts,
          (context) => context.id,
        ),
    })
    .create({
      auth: true,
      summary: "Create or find a scoped context",
      paramSchema: teammateParamsSchema,
      bodySchema: ensureTeammateContextSchema,
      responses: { 200: { description: "The context", schema: teammateContextSchema } },
      handler: ({ serviceContext, params, body }) =>
        ensureTeammateContext(serviceContext, params.teammate_id, body.scope),
    });

  const contexts = teammates.collection("contexts", "context_id");

  contexts.update({
    auth: true,
    summary: "Change a context's lifecycle, autonomy, rules or pause",
    description:
      "Sets the context status, how much it may do without asking, its per-tool rules, or when its background work resumes.",
    paramSchema: contextParamsSchema,
    bodySchema: updateTeammateContextSchema,
    responses: { 200: { description: "The context", schema: teammateContextSchema } },
    handler: async ({ serviceContext, params, body }) => {
      let updated: TeammateContext | null = null;

      if (body.status) {
        updated = await updateTeammateContextStatus(serviceContext, params.context_id, body.status);
      }

      if (body.autonomyLevel) {
        updated = await updateTeammateContextAutonomy(
          serviceContext,
          params.context_id,
          body.autonomyLevel,
        );
      }

      if (body.toolRules) {
        updated = await updateTeammateContextToolRules(
          serviceContext,
          params.context_id,
          body.toolRules,
        );
      }

      if (body.pausedUntil !== undefined) {
        updated = await updateTeammateContextPause(
          serviceContext,
          params.context_id,
          body.pausedUntil,
        );
      }

      return updated;
    },
  });

  contexts
    .singleton("connections")
    .read({
      auth: true,
      summary: "List a context's connection grants",
      paramSchema: contextParamsSchema,
      responses: {
        200: { description: "Grants", schema: teammateConnectionGrantListResponseSchema },
      },
      handler: ({ serviceContext, params }) =>
        listTeammateConnectionGrants(serviceContext, params.context_id),
    })
    .update({
      auth: true,
      summary: "Grant exact connection operations to a context",
      paramSchema: contextParamsSchema,
      bodySchema: upsertTeammateConnectionGrantSchema,
      responses: { 200: { description: "The grant", schema: teammateConnectionGrantSchema } },
      handler: ({ serviceContext, params, body }) =>
        upsertTeammateConnectionGrant(serviceContext, params.context_id, body),
    });
});

export default app;
