import { generateSiteFiles } from "@ngriffin_uk/polychat-library-sites";
import {
  errorResponseSchema,
  listSitesQuerySchema,
  siteBuildRequestSchema,
  siteBuildResponseSchema,
  siteFilesResponseSchema,
  siteGenerateRequestSchema,
  siteListResponseSchema,
  siteResponseSchema,
  SITES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { buildSiteInSandbox } from "~/modules/sites/application/build";
import { streamSiteGeneration } from "~/modules/sites/application/generate";
import { deleteSite, getSite, listSites } from "~/modules/sites/application/records";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

const app = new Hono();

const siteParamsSchema = z.object({ id: z.string().min(1) });

addRoute(app, "post", "/generate", {
  tags: ["sites"],
  summary: "Generate or refine a site",
  description:
    "Classifies the brief with Jev, then streams the site as JSON patch events while a tiered coding model writes it. Pass siteId to refine an existing site instead of starting fresh. Ends with the saved record.",
  auth: true,
  bodySchema: siteGenerateRequestSchema,
  responses: {
    200: { description: "Server-sent site events" },
    400: { description: "Bad request", schema: errorResponseSchema },
  },
  handler: async ({ body, serviceContext, user, raw }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      body.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    return streamSiteGeneration({
      context: serviceContext,
      user,
      request: body,
      signal: raw.req.raw.signal,
    });
  },
});

addRoute(app, "get", "/", {
  tags: ["sites"],
  summary: "List sites",
  auth: true,
  querySchema: listSitesQuerySchema,
  responses: {
    200: { description: "Site summaries", schema: siteListResponseSchema },
  },
  handler: async ({ query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    return {
      sites: await listSites(
        { context: serviceContext, userId: user.id, projectId: query.projectId },
        query.limit,
      ),
    };
  },
});

addRoute(app, "get", "/:id", {
  tags: ["sites"],
  summary: "Get a site",
  auth: true,
  paramSchema: siteParamsSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "Site record", schema: siteResponseSchema },
    404: { description: "Not found", schema: errorResponseSchema },
  },
  handler: async ({ params, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    return {
      site: await getSite(
        { context: serviceContext, userId: user.id, projectId: query.projectId },
        params.id,
      ),
    };
  },
});

addRoute(app, "delete", "/:id", {
  tags: ["sites"],
  summary: "Delete a site",
  auth: true,
  paramSchema: siteParamsSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "Deleted", schema: z.object({ success: z.literal(true) }) },
    404: { description: "Not found", schema: errorResponseSchema },
  },
  handler: async ({ params, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );
    await deleteSite(
      { context: serviceContext, userId: user.id, projectId: query.projectId },
      params.id,
    );

    return { success: true as const };
  },
});

addRoute(app, "get", "/:id/files", {
  tags: ["sites"],
  summary: "Export a site as project files",
  description:
    "Deterministically generates a runnable Next.js and Tailwind project from the saved site.",
  auth: true,
  paramSchema: siteParamsSchema,
  querySchema: projectScopeQuerySchema,
  responses: {
    200: { description: "Generated files", schema: siteFilesResponseSchema },
    404: { description: "Not found", schema: errorResponseSchema },
  },
  handler: async ({ params, query, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      query.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    const site = await getSite(
      { context: serviceContext, userId: user.id, projectId: query.projectId },
      params.id,
    );

    return { files: generateSiteFiles(site.project).files };
  },
});

addRoute(app, "post", "/:id/build", {
  tags: ["sites"],
  summary: "Build a site in the project sandbox",
  description:
    "Hands the generated project files to the sandbox worker as a feature-implementation run against the project's coding environment.",
  auth: true,
  paramSchema: siteParamsSchema,
  bodySchema: siteBuildRequestSchema,
  responses: {
    200: { description: "Queued sandbox run", schema: siteBuildResponseSchema },
    409: { description: "No coding environment", schema: errorResponseSchema },
  },
  handler: ({ params, body, serviceContext, user }) =>
    buildSiteInSandbox({
      context: serviceContext,
      user,
      siteId: params.id,
      projectId: body.projectId,
      instructions: body.instructions,
    }),
});

export default app;
