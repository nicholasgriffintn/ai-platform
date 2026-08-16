import { Hono } from "hono";
import z from "zod/v4";

import {
	addProjectCapabilitySchema,
	authoredSkillDocumentSchema,
	authoredSkillInputSchema,
	authoredSkillListResponseSchema,
	errorResponseSchema,
	projectDetailSchema,
	skillIdSchema,
	updateProjectSchema,
} from "@ngriffin_uk/polychat-schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import {
	addProjectCapability,
	archiveProject,
	getProject,
	removeProjectCapability,
	updateProject,
} from "~/services/workspaces";
import {
	deleteProjectSkill,
	getProjectSkill,
	listProjectSkills,
	publishProjectSkill,
	updateProjectSkill,
} from "~/services/skills";

const app = new Hono();
const projectParams = z.object({ projectId: z.string().min(1) });

addRoute(app, "get", "/:projectId", {
	auth: true,
	tags: ["projects"],
	summary: "Get a project work surface",
	paramSchema: projectParams,
	responses: { 200: { description: "Project details", schema: projectDetailSchema } },
	handler: ({ serviceContext, params }) => getProject(serviceContext, params.projectId),
});

addRoute(app, "put", "/:projectId", {
	auth: true,
	tags: ["projects"],
	summary: "Update a project",
	paramSchema: projectParams,
	bodySchema: updateProjectSchema,
	responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
	handler: ({ serviceContext, params, body }) =>
		updateProject(serviceContext, params.projectId, body),
});

addRoute(app, "delete", "/:projectId", {
	auth: true,
	tags: ["projects"],
	summary: "Archive a project",
	paramSchema: projectParams,
	handler: ({ serviceContext, params }) => archiveProject(serviceContext, params.projectId),
});

addRoute(app, "post", "/:projectId/capabilities", {
	auth: true,
	tags: ["projects"],
	summary: "Add an app, recipe, or tool to a project",
	paramSchema: projectParams,
	bodySchema: addProjectCapabilitySchema,
	responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
	handler: ({ serviceContext, params, body }) =>
		addProjectCapability(serviceContext, params.projectId, body),
});

addRoute(app, "delete", "/:projectId/capabilities/:capabilityId", {
	auth: true,
	tags: ["projects"],
	summary: "Remove a capability from a project",
	paramSchema: projectParams.extend({ capabilityId: z.string().min(1) }),
	responses: { 200: { description: "Updated project", schema: projectDetailSchema } },
	handler: ({ serviceContext, params }) =>
		removeProjectCapability(serviceContext, params.projectId, params.capabilityId),
});

addRoute(app, "get", "/:projectId/skills", {
	auth: true,
	tags: ["projects", "skills"],
	summary: "List published project skills",
	paramSchema: projectParams,
	responses: {
		200: { description: "Published skills", schema: authoredSkillListResponseSchema },
	},
	handler: ({ serviceContext, params }) => listProjectSkills(serviceContext, params.projectId),
});

addRoute(app, "post", "/:projectId/skills", {
	auth: true,
	tags: ["projects", "skills"],
	summary: "Publish a skill to a project",
	paramSchema: projectParams,
	bodySchema: authoredSkillInputSchema,
	responses: {
		200: { description: "Published skill", schema: authoredSkillDocumentSchema },
		400: { description: "Invalid skill document", schema: errorResponseSchema },
		403: { description: "Project admin access required", schema: errorResponseSchema },
		409: { description: "Skill name already exists", schema: errorResponseSchema },
	},
	handler: ({ body, params, serviceContext, user }) =>
		publishProjectSkill(serviceContext, user.id, params.projectId, body),
});

const projectSkillParams = projectParams.extend({ skillId: skillIdSchema });

addRoute(app, "get", "/:projectId/skills/:skillId", {
	auth: true,
	tags: ["projects", "skills"],
	summary: "Get a published project skill",
	paramSchema: projectSkillParams,
	responses: {
		200: { description: "Published skill", schema: authoredSkillDocumentSchema },
		404: { description: "Skill not found", schema: errorResponseSchema },
	},
	handler: ({ params, serviceContext }) =>
		getProjectSkill(serviceContext, params.projectId, params.skillId),
});

addRoute(app, "put", "/:projectId/skills/:skillId", {
	auth: true,
	tags: ["projects", "skills"],
	summary: "Update a published project skill",
	paramSchema: projectSkillParams,
	bodySchema: authoredSkillInputSchema,
	responses: {
		200: { description: "Updated skill", schema: authoredSkillDocumentSchema },
		400: { description: "Invalid skill document", schema: errorResponseSchema },
		403: { description: "Project admin access required", schema: errorResponseSchema },
		404: { description: "Skill not found", schema: errorResponseSchema },
	},
	handler: ({ body, params, serviceContext, user }) =>
		updateProjectSkill(serviceContext, user.id, params.projectId, params.skillId, body),
});

addRoute(app, "delete", "/:projectId/skills/:skillId", {
	auth: true,
	tags: ["projects", "skills"],
	summary: "Unpublish a project skill",
	paramSchema: projectSkillParams,
	responses: {
		403: { description: "Project admin access required", schema: errorResponseSchema },
		404: { description: "Skill not found", schema: errorResponseSchema },
	},
	handler: async ({ params, serviceContext, user }) => {
		await deleteProjectSkill(serviceContext, user.id, params.projectId, params.skillId);
		return { success: true };
	},
});

export default app;
