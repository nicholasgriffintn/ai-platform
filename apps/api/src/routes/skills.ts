import { Hono } from "hono";
import z from "zod/v4";

import {
	authoredSkillDocumentSchema,
	authoredSkillInputSchema,
	authoredSkillListResponseSchema,
	errorResponseSchema,
	skillAvailabilityResponseSchema,
	skillAvailabilitySchema,
	skillIdSchema,
	setSkillEnabledSchema,
} from "@ngriffin_uk/polychat-schemas";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import {
	createPersonalSkill,
	deletePersonalSkill,
	getPersonalSkill,
	getPersonalSkillAvailability,
	listPersonalSkills,
	setPersonalSkillEnabled,
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
