import {
  errorResponseSchema,
  siteBrowserEvidenceSchema,
  siteBrowserVerificationRequestSchema,
  siteConnectorSnapshotRequestSchema,
  siteDataRequestSchema,
  siteDataResponseSchema,
  siteIntegrationScopeSchema,
  siteResponseSchema,
  siteRuntimeStatusSchema,
  siteSourceRefreshRequestSchema,
} from "@ngriffin_uk/polychat-schemas";
import type { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { verifyAndRepairSite } from "~/modules/sites/application/browser-verification";
import {
  snapshotSiteConnector,
  refreshSiteConnectorSource,
} from "~/modules/sites/application/connector-data";
import {
  activateSiteRuntime,
  disableSiteRuntime,
  executeSiteDataAction,
  readSiteData,
} from "~/modules/sites/application/runtime";

const siteParams = z.object({ id: z.string().min(1) });

export function registerSiteIntegrationRoutes(app: Hono): void {
  addRoute(app, "post", "/:id/data/refresh", {
    tags: ["sites"],
    summary: "Refresh a saved connector source",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteSourceRefreshRequestSchema,
    responses: { 200: { description: "Updated site", schema: siteResponseSchema } },
    handler: async ({ params, body, serviceContext }) => ({
      site: await refreshSiteConnectorSource(serviceContext, params.id, body),
    }),
  });
  addRoute(app, "post", "/:id/verify", {
    tags: ["sites"],
    summary: "Verify a site revision in desktop and mobile browsers",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteBrowserVerificationRequestSchema,
    responses: { 200: { description: "Browser evidence", schema: siteBrowserEvidenceSchema } },
    handler: ({ params, body, serviceContext, raw }) =>
      verifyAndRepairSite(serviceContext, params.id, body, raw.req.raw.signal),
  });
  addRoute(app, "post", "/:id/data/read", {
    tags: ["sites"],
    summary: "Read scoped site data",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteIntegrationScopeSchema,
    responses: { 200: { description: "Site data", schema: siteDataResponseSchema } },
    handler: ({ params, body, serviceContext }) => readSiteData(serviceContext, params.id, body),
  });

  addRoute(app, "post", "/:id/data/actions", {
    tags: ["sites"],
    summary: "Run a persistent site data action",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteDataRequestSchema,
    responses: {
      200: { description: "Updated data", schema: siteDataResponseSchema },
      409: { description: "Revision conflict", schema: errorResponseSchema },
    },
    handler: ({ params, body, serviceContext }) =>
      executeSiteDataAction(serviceContext, params.id, body),
  });

  addRoute(app, "post", "/:id/runtime", {
    tags: ["sites"],
    summary: "Enable persistent app storage",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteIntegrationScopeSchema,
    responses: { 200: { description: "Runtime status", schema: siteRuntimeStatusSchema } },
    handler: ({ params, body, serviceContext }) =>
      activateSiteRuntime(serviceContext, params.id, body),
  });

  addRoute(app, "post", "/:id/runtime/disable", {
    tags: ["sites"],
    summary: "Disable app storage while preserving records",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteIntegrationScopeSchema,
    responses: { 200: { description: "Runtime status", schema: siteRuntimeStatusSchema } },
    handler: ({ params, body, serviceContext }) =>
      disableSiteRuntime(serviceContext, params.id, body),
  });

  addRoute(app, "post", "/:id/data/connectors", {
    tags: ["sites"],
    summary: "Refresh a site data source from a read-only connector",
    auth: true,
    paramSchema: siteParams,
    bodySchema: siteConnectorSnapshotRequestSchema,
    responses: { 200: { description: "Updated site", schema: siteResponseSchema } },
    handler: async ({ params, body, serviceContext }) => ({
      site: await snapshotSiteConnector(serviceContext, params.id, body),
    }),
  });
}
