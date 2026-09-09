import {
  createTemplateSchema,
  instantiateProjectStarterSchema,
  instantiateProjectTemplateSchema,
  projectDetailSchema,
  projectStarterListResponseSchema,
  templateListQuerySchema,
  templateListResponseSchema,
  templateSchema,
  updateTemplateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  instantiateProjectTemplate,
  listTemplates,
  updateTemplate,
} from "~/services/templates";
import { instantiateProjectStarter, listProjectStarters } from "~/services/templates/starters";

const app = new Hono();
const templateParams = z.object({ templateId: z.string().min(1) });
const starterParams = z.object({ starterSlug: z.string().min(1) });

addRoute(app, "get", "/starters", {
  tags: ["templates"],
  auth: true,
  responses: { 200: { description: "Project starters", schema: projectStarterListResponseSchema } },
  handler: async () => listProjectStarters(),
});
addRoute(app, "post", "/starters/:starterSlug/instantiate", {
  tags: ["templates"],
  auth: true,
  paramSchema: starterParams,
  bodySchema: instantiateProjectStarterSchema,
  responses: { 200: { description: "Created project", schema: projectDetailSchema } },
  handler: ({ body, params, serviceContext, user }) =>
    instantiateProjectStarter(
      serviceContext,
      user.id,
      params.starterSlug,
      body.workspaceId,
      body.name,
    ),
});

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
  paramSchema: templateParams,
  responses: { 200: { description: "Template", schema: templateSchema } },
  handler: ({ params, serviceContext, user }) =>
    getTemplate(serviceContext, user.id, params.templateId),
});
addRoute(app, "put", "/:templateId", {
  tags: ["templates"],
  auth: true,
  paramSchema: templateParams,
  bodySchema: updateTemplateSchema,
  responses: { 200: { description: "Updated template", schema: templateSchema } },
  handler: ({ body, params, serviceContext, user }) =>
    updateTemplate(serviceContext, user.id, params.templateId, body),
});
addRoute(app, "post", "/:templateId/instantiate", {
  tags: ["templates"],
  auth: true,
  paramSchema: templateParams,
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
  paramSchema: templateParams,
  handler: async ({ params, serviceContext, user }) => {
    await deleteTemplate(serviceContext, user.id, params.templateId);

    return { success: true };
  },
});
export default app;
