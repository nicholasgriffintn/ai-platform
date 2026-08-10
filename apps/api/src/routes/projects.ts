import { Hono } from "hono";
import z from "zod/v4";

import {
	addProjectCapabilitySchema,
	projectDetailSchema,
	updateProjectSchema,
} from "@assistant/schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import {
	addProjectCapability,
	archiveProject,
	getProject,
	removeProjectCapability,
	updateProject,
} from "~/services/workspaces";

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

export default app;
