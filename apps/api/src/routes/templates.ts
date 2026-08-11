import { Hono } from "hono";
import z from "zod/v4";
import {
	createTemplateSchema,
	instantiateProjectTemplateSchema,
	projectDetailSchema,
	templateListQuerySchema,
	templateListResponseSchema,
	templateSchema,
	updateTemplateSchema,
} from "@assistant/schemas";
import { addRoute } from "~/lib/http/routeBuilder";
import {
	createTemplate,
	deleteTemplate,
	getTemplate,
	instantiateProjectTemplate,
	listTemplates,
	updateTemplate,
} from "~/services/templates";

const app = new Hono();
const params = z.object({ templateId: z.string().min(1) });
addRoute(app, "get", "/", {
	tags: ["templates"],
	auth: true,
	querySchema: templateListQuerySchema,
	responses: { 200: { description: "Templates", schema: templateListResponseSchema } },
	handler: ({ query, serviceContext, user }) => listTemplates(serviceContext, user.id, query),
});
addRoute(app, "post", "/", {
	tags: ["templates"],
	auth: true,
	bodySchema: createTemplateSchema,
	responses: { 200: { description: "Created template", schema: templateSchema } },
	handler: ({ body, serviceContext, user }) => createTemplate(serviceContext, user.id, body),
});
addRoute(app, "get", "/:templateId", {
	tags: ["templates"],
	auth: true,
	paramSchema: params,
	responses: { 200: { description: "Template", schema: templateSchema } },
	handler: ({ params, serviceContext, user }) =>
		getTemplate(serviceContext, user.id, params.templateId),
});
addRoute(app, "put", "/:templateId", {
	tags: ["templates"],
	auth: true,
	paramSchema: params,
	bodySchema: updateTemplateSchema,
	responses: { 200: { description: "Updated template", schema: templateSchema } },
	handler: ({ body, params, serviceContext, user }) =>
		updateTemplate(serviceContext, user.id, params.templateId, body),
});
addRoute(app, "post", "/:templateId/instantiate", {
	tags: ["templates"],
	auth: true,
	paramSchema: params,
	bodySchema: instantiateProjectTemplateSchema,
	responses: { 200: { description: "Created project", schema: projectDetailSchema } },
	handler: ({ body, params, serviceContext, user }) =>
		instantiateProjectTemplate(
			serviceContext,
			user.id,
			params.templateId,
			body.workspaceId,
			body.name,
		),
});
addRoute(app, "delete", "/:templateId", {
	tags: ["templates"],
	auth: true,
	paramSchema: params,
	handler: async ({ params, serviceContext, user }) => {
		await deleteTemplate(serviceContext, user.id, params.templateId);
		return { success: true };
	},
});
export default app;
