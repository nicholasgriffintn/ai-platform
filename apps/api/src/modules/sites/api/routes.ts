import { generateSiteFiles } from "@ngriffin_uk/polychat-library-sites";
import {
  errorResponseSchema,
  listSitesQuerySchema,
  siteBuildRequestSchema,
  siteBuildResponseSchema,
  siteEditRequestSchema,
  siteEvaluationRequestSchema,
  siteEvaluationResponseSchema,
  siteFilesResponseSchema,
  siteGenerateRequestSchema,
  siteImagesRequestSchema,
  siteImagesResponseSchema,
  siteListResponseSchema,
  sitePullRequestRequestSchema,
  sitePullRequestResponseSchema,
  siteResponseSchema,
  SITES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { requireAdmin } from "~/middleware/adminMiddleware";
import { buildSiteInSandbox } from "~/modules/sites/application/build";
import { editSite } from "~/modules/sites/application/edit";
import { evaluateSitePrompts } from "~/modules/sites/application/evaluate";
import { streamSiteGeneration } from "~/modules/sites/application/generate";
import { fillSiteImages } from "~/modules/sites/application/images";
import { openSitePullRequest } from "~/modules/sites/application/pull-request";
import { deleteSite, getSite, listSites } from "~/modules/sites/application/records";
import { readSharedSiteImage } from "~/modules/sites/application/shared-images";
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

addRoute(app, "get", "/shared/:token/images/:outputId", {
  tags: ["sites"],
  summary: "Serve an image referenced by a publicly shared site",
  paramSchema: z.object({ token: z.string().min(32), outputId: z.string().min(1) }),
  responses: { 200: { description: "Image file" } },
  handler: ({ params, serviceContext }) =>
    readSharedSiteImage(serviceContext, params.token, params.outputId),
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

addRoute(app, "patch", "/:id", {
  tags: ["sites"],
  summary: "Edit a site without a model",
  description:
    "Applies JSON patches from the studio's inspector (prop edits, moves, removals, duplicates) to the saved site, validates the result and stores a new revision.",
  auth: true,
  paramSchema: siteParamsSchema,
  bodySchema: siteEditRequestSchema,
  responses: {
    200: { description: "Updated site", schema: siteResponseSchema },
    400: { description: "Edit could not be applied", schema: errorResponseSchema },
  },
  handler: async ({ params, body, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      body.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    return {
      site: await editSite({ context: serviceContext, user, siteId: params.id, request: body }),
    };
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

addRoute(app, "post", "/:id/images", {
  tags: ["sites"],
  summary: "Generate images for a site's placeholders",
  description:
    "Generates an image for each empty image slot (split heroes, Image elements, galleries, team portraits) from its alt text, stores them as outputs and patches the site.",
  auth: true,
  paramSchema: siteParamsSchema,
  bodySchema: siteImagesRequestSchema,
  responses: {
    200: { description: "Site with generated images", schema: siteImagesResponseSchema },
  },
  handler: async ({ params, body, serviceContext, user }) => {
    await requireOptionalProjectCapabilityAccess(
      serviceContext,
      body.projectId,
      "app",
      SITES_CAPABILITY_ID,
    );

    return fillSiteImages({
      context: serviceContext,
      user,
      siteId: params.id,
      projectId: body.projectId,
      limit: body.limit,
    });
  },
});

addRoute(app, "post", "/:id/pull-request", {
  tags: ["sites"],
  summary: "Open a pull request with the generated site",
  description:
    "Commits the deterministic project files to a new branch of the project's connected repository and opens a pull request. No model or sandbox run is involved.",
  auth: true,
  paramSchema: siteParamsSchema,
  bodySchema: sitePullRequestRequestSchema,
  responses: {
    200: { description: "Opened pull request", schema: sitePullRequestResponseSchema },
    409: { description: "No coding environment", schema: errorResponseSchema },
  },
  handler: ({ params, body, serviceContext, user }) =>
    openSitePullRequest({ context: serviceContext, user, siteId: params.id, request: body }),
});

addRoute(app, "post", "/evaluate", {
  tags: ["sites"],
  summary: "Run the site prompt evaluation",
  description:
    "Generates every brief under each prompt variant without saving anything, scores each result with Jev (brief coverage, placeholder copy, coherence) and reports the best variant. Admin only; every run spends model tokens.",
  auth: true,
  middleware: [requireAdmin],
  bodySchema: siteEvaluationRequestSchema,
  responses: {
    200: { description: "Evaluation summary", schema: siteEvaluationResponseSchema },
  },
  handler: ({ body, serviceContext, user }) =>
    evaluateSitePrompts({ context: serviceContext, user, request: body }),
});

export default app;
