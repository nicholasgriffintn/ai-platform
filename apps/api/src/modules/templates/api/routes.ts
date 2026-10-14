import {
  createTemplateSchema,
  projectStarterListResponseSchema,
  templateListQuerySchema,
  templateListResponseSchema,
  templateSchema,
  updateTemplateSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import {
  createTemplate,
  deleteTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
} from "~/modules/templates/application";
import { listProjectStarters } from "~/modules/templates/application/starters";

const app = new Hono();
const templateParamsSchema = z.object({ template_id: z.string().min(1) });

defineResource(app, { idParam: "template_id", tags: ["templates"] }, (templates) => {
  templates
    .list({
      auth: true,
      summary: "List templates",
      description: "Personal templates, or a workspace's when workspace_id is set.",
      querySchema: templateListQuerySchema,
      responses: { 200: { description: "Templates", schema: templateListResponseSchema } },
      handler: ({ query, serviceContext, user }) =>
        listTemplates(serviceContext, user.id, {
          workspaceId: query.workspace_id,
          kind: query.kind,
        }),
    })
    .create({
      auth: true,
      summary: "Create a template",
      bodySchema: createTemplateSchema,
      responses: { 200: { description: "The template", schema: templateSchema } },
      handler: ({ body, serviceContext, user }) => createTemplate(serviceContext, user.id, body),
    })
    .read({
      auth: true,
      summary: "Read a template",
      paramSchema: templateParamsSchema,
      responses: { 200: { description: "The template", schema: templateSchema } },
      handler: ({ params, serviceContext, user }) =>
        getTemplate(serviceContext, user.id, params.template_id),
    })
    .update({
      auth: true,
      summary: "Update a template",
      paramSchema: templateParamsSchema,
      bodySchema: updateTemplateSchema,
      responses: { 200: { description: "The template", schema: templateSchema } },
      handler: ({ body, params, serviceContext, user }) =>
        updateTemplate(serviceContext, user.id, params.template_id, body),
    })
    .delete({
      auth: true,
      summary: "Delete a template",
      paramSchema: templateParamsSchema,
      handler: async ({ params, serviceContext, user }) => {
        await deleteTemplate(serviceContext, user.id, params.template_id);

        return { deleted: true };
      },
    });

  templates.collection("starters", "starter_id").list({
    auth: true,
    summary: "List project starters",
    description: "Built-in starters. Create a project from one with POST /projects and starter_id.",
    responses: { 200: { description: "Starters", schema: projectStarterListResponseSchema } },
    handler: async () => listProjectStarters(),
  });
});

export default app;
