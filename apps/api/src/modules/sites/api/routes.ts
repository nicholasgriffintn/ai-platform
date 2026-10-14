import { generateSiteFiles } from "@ngriffin_uk/polychat-library-sites";
import {
  listPageOf,
  siteBrowserEvidenceSchema,
  siteBrowserVerificationRequestSchema,
  siteConnectorSnapshotRequestSchema,
  siteSourceRefreshRequestSchema,
  siteDataResponseSchema,
  siteDataRequestSchema,
  siteRuntimeStatusSchema,
  siteIntegrationScopeSchema,
  listSitesQuerySchema,
  siteBuildRequestSchema,
  siteBuildResponseSchema,
  siteEditRequestSchema,
  siteFilesQuerySchema,
  siteFilesResponseSchema,
  siteGenerateRequestSchema,
  siteImagesRequestSchema,
  siteListResponseSchema,
  sitePullRequestRequestSchema,
  sitePullRequestResponseSchema,
  siteResponseSchema,
  SITES_CAPABILITY_ID,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { defineResource } from "~/infrastructure/http/resource";
import { verifyAndRepairSite } from "~/modules/sites/application/browser-verification";
import { buildSiteInSandbox } from "~/modules/sites/application/build";
import {
  snapshotSiteConnector,
  refreshSiteConnectorSource,
} from "~/modules/sites/application/connector-data";
import { editSite } from "~/modules/sites/application/edit";
import { streamSiteGeneration } from "~/modules/sites/application/generate";
import { streamSiteImages } from "~/modules/sites/application/images";
import { openSitePullRequest } from "~/modules/sites/application/pull-request";
import { deleteSite, getSite, listSites } from "~/modules/sites/application/records";
import {
  activateSiteRuntime,
  disableSiteRuntime,
  executeSiteDataAction,
  readSiteData,
} from "~/modules/sites/application/runtime";
import { readSharedSiteImage } from "~/modules/sites/application/shared-images";
import {
  projectScopeQuerySchema,
  requireOptionalProjectCapabilityAccess,
} from "~/modules/workspaces/application/access";

const app = new Hono();

const siteParamsSchema = z.object({ site_id: z.string().min(1) });
const sharedImageParamsSchema = z.object({
  token: z.string().min(32),
  image_id: z.string().min(1),
});

function requireSitesAccess(
  serviceContext: Parameters<typeof requireOptionalProjectCapabilityAccess>[0],
  projectId: string | undefined,
) {
  return requireOptionalProjectCapabilityAccess(
    serviceContext,
    projectId,
    "app",
    SITES_CAPABILITY_ID,
  );
}

defineResource(app, { idParam: "site_id", tags: ["sites"] }, (sites) => {
  sites
    .list({
      auth: true,
      summary: "List sites",
      querySchema: listSitesQuerySchema,
      responses: { 200: { description: "Sites", schema: siteListResponseSchema } },
      handler: async ({ query, serviceContext, user }) => {
        await requireSitesAccess(serviceContext, query.project_id);

        return listPageOf(
          await listSites(
            { context: serviceContext, userId: user.id, projectId: query.project_id },
            query.limit,
          ),
          (site) => site.id,
        );
      },
    })
    .collectionAction("generate", {
      auth: true,
      summary: "Generate or refine a site",
      description:
        "Classifies the brief with Jev, then streams site changes as JSON patch events. High-confidence single visual edits to a selected element are applied directly by Jev; broader or uncertain work uses a tiered coding model. Pass siteId to refine an existing site instead of starting fresh. Ends with the saved record.",
      bodySchema: siteGenerateRequestSchema,
      responses: { 200: { description: "Server-sent site events" } },
      handler: async ({ body, serviceContext, user, raw }) => {
        await requireSitesAccess(serviceContext, body.projectId);

        return streamSiteGeneration({
          context: serviceContext,
          user,
          request: body,
          signal: raw.req.raw.signal,
        });
      },
    })
    .shared(
      {
        auth: false,
        summary: "Serve an image referenced by a publicly shared site",
        paramSchema: sharedImageParamsSchema,
        responses: { 200: { description: "Image file" } },
        handler: ({ params, serviceContext }) =>
          readSharedSiteImage(serviceContext, params.token, params.image_id),
      },
      "images/:image_id",
    )
    .read({
      auth: true,
      summary: "Get a site",
      paramSchema: siteParamsSchema,
      querySchema: projectScopeQuerySchema,
      responses: { 200: { description: "The site", schema: siteResponseSchema } },
      handler: async ({ params, query, serviceContext, user }) => {
        await requireSitesAccess(serviceContext, query.project_id);

        return {
          site: await getSite(
            { context: serviceContext, userId: user.id, projectId: query.project_id },
            params.site_id,
          ),
        };
      },
    })
    .update({
      auth: true,
      summary: "Edit a site without a model",
      description:
        "Applies JSON patches from the studio inspector (prop edits, moves, removals, duplicates) to the saved site, validates the result and stores a new revision.",
      paramSchema: siteParamsSchema,
      bodySchema: siteEditRequestSchema,
      responses: { 200: { description: "The site", schema: siteResponseSchema } },
      handler: async ({ params, body, serviceContext, user }) => {
        await requireSitesAccess(serviceContext, body.projectId);

        return {
          site: await editSite({
            context: serviceContext,
            user,
            siteId: params.site_id,
            request: body,
          }),
        };
      },
    })
    .delete({
      auth: true,
      summary: "Delete a site",
      paramSchema: siteParamsSchema,
      querySchema: projectScopeQuerySchema,
      handler: async ({ params, query, serviceContext, user }) => {
        await requireSitesAccess(serviceContext, query.project_id);
        await deleteSite(
          { context: serviceContext, userId: user.id, projectId: query.project_id },
          params.site_id,
        );

        return { deleted: true };
      },
    })
    .action("verify", {
      auth: true,
      summary: "Verify a site revision in desktop and mobile browsers",
      paramSchema: siteParamsSchema,
      bodySchema: siteBrowserVerificationRequestSchema,
      responses: { 200: { description: "Browser evidence", schema: siteBrowserEvidenceSchema } },
      handler: ({ params, body, serviceContext, raw }) =>
        verifyAndRepairSite(serviceContext, params.site_id, body, raw.req.raw.signal),
    })
    .action("build", {
      auth: true,
      summary: "Build a site in the project sandbox",
      description:
        "Hands the generated project files to the sandbox worker as a feature-implementation run against the project coding environment.",
      paramSchema: siteParamsSchema,
      bodySchema: siteBuildRequestSchema,
      responses: { 200: { description: "Queued sandbox run", schema: siteBuildResponseSchema } },
      handler: ({ params, body, serviceContext, user }) =>
        buildSiteInSandbox({
          context: serviceContext,
          user,
          siteId: params.site_id,
          projectId: body.projectId,
          instructions: body.instructions,
          target: body.target,
        }),
    })
    .action("images", {
      auth: true,
      summary: "Generate images for the placeholders of a site",
      description:
        "Generates an image for each empty image slot (split heroes, Image elements, galleries, team portraits) from its alt text, stores them as outputs and patches the site.",
      paramSchema: siteParamsSchema,
      bodySchema: siteImagesRequestSchema,
      responses: {
        200: { description: "Server-sent image progress and the site with generated images" },
      },
      handler: async ({ params, body, serviceContext, user }) => {
        await requireSitesAccess(serviceContext, body.projectId);

        return streamSiteImages({
          context: serviceContext,
          user,
          siteId: params.site_id,
          projectId: body.projectId,
          limit: body.limit,
        });
      },
    })
    .action("pull_request", {
      auth: true,
      summary: "Open a pull request with the generated site",
      description:
        "Commits the deterministic project files to a new branch of the connected repository and opens a pull request. No model or sandbox run is involved.",
      paramSchema: siteParamsSchema,
      bodySchema: sitePullRequestRequestSchema,
      responses: { 200: { description: "Pull request", schema: sitePullRequestResponseSchema } },
      handler: ({ params, body, serviceContext, user }) =>
        openSitePullRequest({
          context: serviceContext,
          user,
          siteId: params.site_id,
          request: body,
        }),
    });

  sites.singleton("files").read({
    auth: true,
    summary: "Export a site as project files",
    description:
      "Deterministically generates a runnable React Router, Next.js or TanStack Router project from the saved site.",
    paramSchema: siteParamsSchema,
    querySchema: siteFilesQuerySchema,
    responses: { 200: { description: "Generated files", schema: siteFilesResponseSchema } },
    handler: async ({ params, query, serviceContext, user }) => {
      await requireSitesAccess(serviceContext, query.project_id);

      const site = await getSite(
        { context: serviceContext, userId: user.id, projectId: query.project_id },
        params.site_id,
      );
      const generated = generateSiteFiles(site.project, query.target);

      return { target: generated.target, files: generated.files };
    },
  });

  sites
    .singleton("data")
    .create({
      auth: true,
      summary: "Update saved site records",
      paramSchema: siteParamsSchema,
      bodySchema: siteDataRequestSchema,
      responses: { 200: { description: "Site data", schema: siteDataResponseSchema } },
      handler: ({ params, body, serviceContext }) =>
        executeSiteDataAction(serviceContext, params.site_id, body),
    })
    .action("query", {
      auth: true,
      summary: "Read scoped site data",
      description: "Reads against the revision the caller names, so stale editors see a conflict.",
      paramSchema: siteParamsSchema,
      bodySchema: siteIntegrationScopeSchema,
      responses: { 200: { description: "Site data", schema: siteDataResponseSchema } },
      handler: ({ params, body, serviceContext }) =>
        readSiteData(serviceContext, params.site_id, body),
    })
    .action("snapshot", {
      auth: true,
      summary: "Read site data from a selected connector account",
      paramSchema: siteParamsSchema,
      bodySchema: siteConnectorSnapshotRequestSchema,
      responses: { 200: { description: "The site", schema: siteResponseSchema } },
      handler: async ({ params, body, serviceContext }) => ({
        site: await snapshotSiteConnector(serviceContext, params.site_id, body),
      }),
    })
    .action("refresh", {
      auth: true,
      summary: "Refresh a saved connector Source",
      paramSchema: siteParamsSchema,
      bodySchema: siteSourceRefreshRequestSchema,
      responses: { 200: { description: "The site", schema: siteResponseSchema } },
      handler: async ({ params, body, serviceContext }) => ({
        site: await refreshSiteConnectorSource(serviceContext, params.site_id, body),
      }),
    });

  sites
    .singleton("runtime")
    .create({
      auth: true,
      summary: "Enable saved records for this revision",
      paramSchema: siteParamsSchema,
      bodySchema: siteIntegrationScopeSchema,
      responses: { 200: { description: "Storage status", schema: siteRuntimeStatusSchema } },
      handler: ({ params, body, serviceContext }) =>
        activateSiteRuntime(serviceContext, params.site_id, body),
    })
    .delete({
      auth: true,
      summary: "Disable saved records",
      paramSchema: siteParamsSchema,
      bodySchema: siteIntegrationScopeSchema,
      responses: { 200: { description: "Storage status", schema: siteRuntimeStatusSchema } },
      handler: ({ params, body, serviceContext }) =>
        disableSiteRuntime(serviceContext, params.site_id, body),
    });
});

export default app;
