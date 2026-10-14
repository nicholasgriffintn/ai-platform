import {
  authoredSkillDocumentSchema,
  authoredSkillDraftInputSchema,
  authoredSkillHistoryResponseSchema,
  authoredSkillImportInputSchema,
  authoredSkillInputSchema,
  authoredSkillListResponseSchema,
  authoredSkillPromotionInputSchema,
  authoredSkillRollbackInputSchema,
  authoredSkillVersionedDocumentSchema,
  errorResponseSchema,
  listPageOf,
  setSkillEnabledSchema,
  skillAvailabilitySchema,
  skillIdSchema,
  teachingSkillDraftInputSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { projectScopeQuerySchema } from "~/modules/workspaces/application/access";

import {
  createTeachingSkillDraft,
  getPersonalSkillAvailability,
  setPersonalSkillEnabled,
} from "../application";
import {
  createScopedSkill,
  deleteScopedSkill,
  getScopedSkill,
  getScopedSkillHistory,
  getScopedSkillRevision,
  importScopedSkill,
  listScopedSkills,
  promoteScopedSkillDraft,
  rollbackScopedSkill,
  saveScopedSkillDraft,
  updateScopedSkill,
} from "../application/scoped";

const app = new Hono();
const skillParamsSchema = z.object({ skill_id: skillIdSchema });
const documentParamsSchema = z.object({ document_id: skillIdSchema });
const revisionParamsSchema = documentParamsSchema.extend({ revision_id: z.string().min(1) });

defineResource(app, { idParam: "skill_id", tags: ["skills"] }, (skills) => {
  skills
    .list({
      auth: true,
      summary: "List skills available to your own conversations",
      description:
        "Every skill with whether it is ready for this user's own conversations. Project skills are managed through project capabilities.",
      handler: async ({ serviceContext, user }) =>
        listPageOf(
          await getPersonalSkillAvailability(serviceContext, user.id),
          (skill) => skill.id,
        ),
    })
    .update({
      auth: true,
      summary: "Turn a skill on or off",
      description: "Always-on skills cannot be changed.",
      paramSchema: skillParamsSchema,
      bodySchema: setSkillEnabledSchema,
      responses: { 200: { description: "The skill", schema: skillAvailabilitySchema } },
      handler: ({ body, params, serviceContext, user }) =>
        setPersonalSkillEnabled(serviceContext, user.id, params.skill_id, body.enabled),
    });

  const documents = skills.collection("documents", "document_id");

  documents
    .list({
      auth: true,
      summary: "List authored skills",
      description: "Personal authored skills, or a project's skills when project_id is set.",
      querySchema: projectScopeQuerySchema,
      responses: {
        200: { description: "Authored skills", schema: authoredSkillListResponseSchema },
      },
      handler: async ({ query, serviceContext, user }) =>
        listPageOf(
          (await listScopedSkills({ context: serviceContext, user, projectId: query.project_id }))
            .skills,
          (skill) => skill.id,
        ),
    })
    .create({
      auth: true,
      summary: "Create an authored skill",
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillInputSchema,
      responses: { 200: { description: "The skill", schema: authoredSkillDocumentSchema } },
      handler: ({ body, query, serviceContext, user }) =>
        createScopedSkill({ context: serviceContext, user, projectId: query.project_id }, body),
    })
    .collectionAction("import", {
      auth: true,
      summary: "Import an authorised skill revision",
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillImportInputSchema,
      handler: ({ body, query, serviceContext, user }) =>
        importScopedSkill({ context: serviceContext, user, projectId: query.project_id }, body),
    })
    .collectionAction("teach", {
      auth: true,
      summary: "Draft a personal skill from supervised teaching",
      description: "Creates a disabled personal skill draft from a recorded teaching session.",
      bodySchema: teachingSkillDraftInputSchema,
      handler: ({ body, serviceContext, user }) =>
        createTeachingSkillDraft(serviceContext, user.id, body),
    })
    .read({
      auth: true,
      summary: "Get an authored skill",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      responses: {
        200: { description: "The skill", schema: authoredSkillDocumentSchema },
        404: { description: "Skill not found", schema: errorResponseSchema },
      },
      handler: ({ params, query, serviceContext, user }) =>
        getScopedSkill(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
        ),
    })
    .update({
      auth: true,
      summary: "Update an authored skill",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillInputSchema,
      responses: { 200: { description: "The skill", schema: authoredSkillDocumentSchema } },
      handler: ({ body, params, query, serviceContext, user }) =>
        updateScopedSkill(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
          body,
        ),
    })
    .delete({
      auth: true,
      summary: "Delete an authored skill",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      handler: ({ params, query, serviceContext, user }) =>
        deleteScopedSkill(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
        ),
    })
    .revisioned()
    .list({
      auth: true,
      summary: "List a skill's revisions",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      responses: {
        200: { description: "Revision history", schema: authoredSkillHistoryResponseSchema },
      },
      handler: async ({ params, query, serviceContext, user }) => {
        const history = await getScopedSkillHistory(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
        );

        return {
          ...listPageOf(history.revisions, (revision) => revision.id),
          skill: history.skill,
          state: history.state,
        };
      },
    })
    .read({
      auth: true,
      summary: "Get one skill revision",
      paramSchema: revisionParamsSchema,
      querySchema: projectScopeQuerySchema,
      responses: {
        200: { description: "The revision", schema: authoredSkillVersionedDocumentSchema },
      },
      handler: ({ params, query, serviceContext, user }) =>
        getScopedSkillRevision(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
          params.revision_id,
        ),
    })
    .draft({
      auth: true,
      summary: "Save a draft without activating it",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillDraftInputSchema,
      handler: ({ body, params, query, serviceContext, user }) =>
        saveScopedSkillDraft(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
          body,
        ),
    })
    .promote({
      auth: true,
      summary: "Promote the current draft",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillPromotionInputSchema,
      handler: ({ body, params, query, serviceContext, user }) =>
        promoteScopedSkillDraft(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
          body,
        ),
    })
    .rollback({
      auth: true,
      summary: "Roll back through a new immutable revision",
      paramSchema: documentParamsSchema,
      querySchema: projectScopeQuerySchema,
      bodySchema: authoredSkillRollbackInputSchema,
      handler: ({ body, params, query, serviceContext, user }) =>
        rollbackScopedSkill(
          { context: serviceContext, user, projectId: query.project_id },
          params.document_id,
          body,
        ),
    });
});

export default app;
