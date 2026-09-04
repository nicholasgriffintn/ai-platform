import {
  authoredSkillDocumentSchema,
  authoredSkillDraftInputSchema,
  authoredSkillEvaluationCaseInputSchema,
  authoredSkillEvaluationCaseListSchema,
  authoredSkillEvaluationCaseSchema,
  authoredSkillEvaluationResultListSchema,
  authoredSkillEvaluationResultSchema,
  authoredSkillEvaluationRunInputSchema,
  authoredSkillHistoryResponseSchema,
  authoredSkillImportInputSchema,
  authoredSkillInputSchema,
  authoredSkillListResponseSchema,
  authoredSkillPromotionInputSchema,
  authoredSkillRollbackInputSchema,
  authoredSkillVersionedDocumentSchema,
  errorResponseSchema,
  skillAvailabilityResponseSchema,
  skillAvailabilitySchema,
  skillIdSchema,
  setSkillEnabledSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
  createPersonalSkill,
  createSkillEvaluationCase,
  deleteSkillEvaluationCase,
  deletePersonalSkill,
  getPersonalSkill,
  getPersonalSkillHistory,
  getPersonalSkillVersion,
  getPersonalSkillAvailability,
  importPersonalSkill,
  listPersonalSkills,
  listSkillEvaluationCases,
  listSkillEvaluationResults,
  setPersonalSkillEnabled,
  promotePersonalSkillDraft,
  rollbackPersonalSkill,
  savePersonalSkillDraft,
  runSkillEvaluation,
  updatePersonalSkill,
} from "~/services/skills";

const app = new Hono();
const routeLogger = createRouteLogger("skills");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing skills route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  auth: true,
  tags: ["skills"],
  summary: "List personal skill availability",
  description:
    "Returns every skill with whether it is ready for this user's own conversations. Project skills are managed through project capabilities.",
  responses: {
    200: { description: "Skill availability", schema: skillAvailabilityResponseSchema },
  },
  handler: async ({ serviceContext, user }) => ({
    skills: await getPersonalSkillAvailability(serviceContext, user.id),
  }),
});

addRoute(app, "put", "/:id/enabled", {
  auth: true,
  tags: ["skills"],
  summary: "Enable or disable a skill",
  description:
    "Turns a skill on or off for this user's own conversations. Always-on skills cannot be changed.",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: setSkillEnabledSchema,
  responses: {
    200: { description: "Updated skill", schema: skillAvailabilitySchema },
    400: { description: "Skill cannot be changed", schema: errorResponseSchema },
    404: { description: "Unknown skill", schema: errorResponseSchema },
  },
  handler: async ({ body, params, serviceContext, user }) =>
    setPersonalSkillEnabled(serviceContext, user.id, params.id, body.enabled),
});

addRoute(app, "get", "/documents", {
  auth: true,
  tags: ["skills"],
  summary: "List personal authored skills",
  responses: {
    200: { description: "Authored skills", schema: authoredSkillListResponseSchema },
  },
  handler: ({ serviceContext, user }) => listPersonalSkills(serviceContext, user.id),
});

addRoute(app, "post", "/documents", {
  auth: true,
  tags: ["skills"],
  summary: "Create a personal skill document",
  bodySchema: authoredSkillInputSchema,
  responses: {
    200: { description: "Created skill", schema: authoredSkillDocumentSchema },
    400: { description: "Invalid skill document", schema: errorResponseSchema },
    409: { description: "Skill name already exists", schema: errorResponseSchema },
  },
  handler: ({ body, serviceContext, user }) => createPersonalSkill(serviceContext, user.id, body),
});

addRoute(app, "post", "/documents/import", {
  auth: true,
  tags: ["skills"],
  summary: "Import an authorised skill revision into personal skills",
  bodySchema: authoredSkillImportInputSchema,
  responses: {
    200: { description: "Imported skill revision", schema: authoredSkillVersionedDocumentSchema },
    403: { description: "Source project admin access required", schema: errorResponseSchema },
    404: { description: "Source skill revision not found", schema: errorResponseSchema },
    409: { description: "Skill name already exists", schema: errorResponseSchema },
  },
  handler: ({ body, serviceContext, user }) => importPersonalSkill(serviceContext, user.id, body),
});

addRoute(app, "get", "/documents/:id", {
  auth: true,
  tags: ["skills"],
  summary: "Get a personal skill document",
  paramSchema: z.object({ id: skillIdSchema }),
  responses: {
    200: { description: "Skill document", schema: authoredSkillDocumentSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    getPersonalSkill(serviceContext, user.id, params.id),
});

addRoute(app, "put", "/documents/:id", {
  auth: true,
  tags: ["skills"],
  summary: "Update a personal skill document",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillInputSchema,
  responses: {
    200: { description: "Updated skill", schema: authoredSkillDocumentSchema },
    400: { description: "Invalid skill document", schema: errorResponseSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    updatePersonalSkill(serviceContext, user.id, params.id, body),
});

addRoute(app, "get", "/documents/:id/history", {
  auth: true,
  tags: ["skills"],
  summary: "List personal skill revision history",
  paramSchema: z.object({ id: skillIdSchema }),
  responses: {
    200: { description: "Skill revision history", schema: authoredSkillHistoryResponseSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    getPersonalSkillHistory(serviceContext, user.id, params.id),
});

addRoute(app, "get", "/documents/:id/revisions/:revisionId", {
  auth: true,
  tags: ["skills"],
  summary: "Get one personal skill revision",
  paramSchema: z.object({ id: skillIdSchema, revisionId: z.string().min(1) }),
  responses: {
    200: { description: "Skill revision", schema: authoredSkillVersionedDocumentSchema },
    404: { description: "Skill revision not found", schema: errorResponseSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    getPersonalSkillVersion(serviceContext, user.id, params.id, params.revisionId),
});

addRoute(app, "put", "/documents/:id/draft", {
  auth: true,
  tags: ["skills"],
  summary: "Save a personal skill draft without activating it",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillDraftInputSchema,
  responses: {
    200: { description: "Saved draft", schema: authoredSkillVersionedDocumentSchema },
    400: { description: "Invalid skill document", schema: errorResponseSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
    409: { description: "Skill changed concurrently", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    savePersonalSkillDraft(serviceContext, user.id, params.id, body),
});

addRoute(app, "post", "/documents/:id/promote", {
  auth: true,
  tags: ["skills"],
  summary: "Promote the current personal skill draft",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillPromotionInputSchema,
  responses: {
    200: { description: "Promoted revision", schema: authoredSkillVersionedDocumentSchema },
    404: { description: "Skill not found", schema: errorResponseSchema },
    409: { description: "Skill changed concurrently", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    promotePersonalSkillDraft(serviceContext, user.id, params.id, body),
});

addRoute(app, "post", "/documents/:id/rollback", {
  auth: true,
  tags: ["skills"],
  summary: "Roll a personal skill back through a new immutable revision",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillRollbackInputSchema,
  responses: {
    200: { description: "Rollback revision", schema: authoredSkillVersionedDocumentSchema },
    404: { description: "Skill revision not found", schema: errorResponseSchema },
    409: { description: "Skill changed concurrently", schema: errorResponseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    rollbackPersonalSkill(serviceContext, user.id, params.id, body),
});

const personalEvaluationCaseParams = z.object({
  id: skillIdSchema,
  caseId: z.string().min(1),
});

addRoute(app, "get", "/documents/:id/evaluation-cases", {
  auth: true,
  tags: ["skills"],
  summary: "List saved evaluation cases for a personal skill",
  paramSchema: z.object({ id: skillIdSchema }),
  responses: {
    200: { description: "Evaluation cases", schema: authoredSkillEvaluationCaseListSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    listSkillEvaluationCases(serviceContext, user.id, params.id),
});

addRoute(app, "post", "/documents/:id/evaluation-cases", {
  auth: true,
  tags: ["skills"],
  summary: "Save an evaluation case for a personal skill",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillEvaluationCaseInputSchema,
  responses: {
    200: { description: "Saved evaluation case", schema: authoredSkillEvaluationCaseSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    createSkillEvaluationCase(serviceContext, user.id, params.id, body),
});

addRoute(app, "delete", "/documents/:id/evaluation-cases/:caseId", {
  auth: true,
  tags: ["skills"],
  summary: "Delete a personal skill evaluation case",
  paramSchema: personalEvaluationCaseParams,
  handler: async ({ params, serviceContext, user }) => {
    await deleteSkillEvaluationCase(serviceContext, user.id, params.id, params.caseId);

    return { success: true };
  },
});

addRoute(app, "get", "/documents/:id/evaluations", {
  auth: true,
  tags: ["skills"],
  summary: "List personal skill evaluation results",
  paramSchema: z.object({ id: skillIdSchema }),
  responses: {
    200: { description: "Evaluation results", schema: authoredSkillEvaluationResultListSchema },
  },
  handler: ({ params, serviceContext, user }) =>
    listSkillEvaluationResults(serviceContext, user.id, params.id),
});

addRoute(app, "post", "/documents/:id/evaluations", {
  auth: true,
  tags: ["skills"],
  summary: "Run an isolated evaluation against one personal skill revision",
  paramSchema: z.object({ id: skillIdSchema }),
  bodySchema: authoredSkillEvaluationRunInputSchema,
  responses: {
    200: { description: "Evaluation result", schema: authoredSkillEvaluationResultSchema },
  },
  handler: ({ body, params, serviceContext, user }) =>
    runSkillEvaluation(serviceContext, user, params.id, body),
});

addRoute(app, "delete", "/documents/:id", {
  auth: true,
  tags: ["skills"],
  summary: "Delete a personal skill document",
  paramSchema: z.object({ id: skillIdSchema }),
  responses: { 404: { description: "Skill not found", schema: errorResponseSchema } },
  handler: async ({ params, serviceContext, user }) => {
    await deletePersonalSkill(serviceContext, user.id, params.id);

    return { success: true };
  },
});

export default app;
