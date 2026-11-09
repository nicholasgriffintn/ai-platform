import {
  capabilityCatalogResponseSchema,
  mcpAppEntryOpenRequestSchema,
  mcpAppViewSchema,
  publicCapabilityCatalogueResponseSchema,
  appSettingsParamsSchema,
  appSettingsResponseSchema,
  appSettingsSchema,
  remoteAppListResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { requirePlan } from "~/middleware/requirePlan";
import {
  readTurnedOffAppIds,
  setAppEnabled,
} from "~/modules/capabilities/application/app-settings";
import { listRemoteApps, openRemoteApp } from "~/modules/capabilities/application/remote-apps";
import { getProjectExperienceCatalog } from "~/modules/capabilities/domain/app-catalogue";
import { MODEL_TOOL_DEFINITIONS } from "~/modules/capabilities/domain/model-tools";
import { listRecipeCatalogueSummaries } from "~/modules/recipes/application";
import { listScopedSkillSummaries } from "~/modules/skills/application";
import { listScopedTeammateSummaries } from "~/modules/teammates/application";
import { listCatalogueTools } from "~/modules/tools/application/toolsOperations";

const app = new Hono();
const routeLogger = createRouteLogger("capabilities");

app.use("/*", (c, next) => {
  routeLogger.info(`Processing capabilities route: ${c.req.path}`);

  return next();
});

addRoute(app, "get", "/", {
  tags: ["capabilities"],
  summary: "List capability catalogue",
  description:
    "Returns the teammates, rich experiences, model tools and skills a project or person can enable. Function tools are published by /tools.",
  auth: "user-or-anonymous",
  querySchema: z.object({ project_id: z.string().min(1).optional() }),
  responses: {
    200: { description: "Capability catalogue", schema: capabilityCatalogResponseSchema },
  },
  handler: async ({ query, serviceContext, user }) => {
    const isPersonal = Boolean(user) && !query.project_id;
    const [teammates, skills, turnedOff] = await Promise.all([
      listScopedTeammateSummaries(serviceContext, user?.id, query.project_id),
      listScopedSkillSummaries(serviceContext, user?.id, query.project_id),
      isPersonal ? readTurnedOffAppIds(serviceContext) : undefined,
    ]);
    const experiences = getProjectExperienceCatalog();

    return {
      teammates,
      experiences: turnedOff
        ? experiences.map((experience) => ({
            ...experience,
            enabled: !turnedOff.has(experience.id),
          }))
        : experiences,
      modelTools: MODEL_TOOL_DEFINITIONS,
      skills,
    };
  },
});

addRoute(app, "get", "/catalogue", {
  tags: ["capabilities"],
  summary: "List the public capability catalogue",
  description:
    "Returns every built-in experience, model tool, function tool and recipe template without filtering by the caller's plan or access. Agents, skills and installed recipes are curated per person or workspace and are not included.",
  responses: {
    200: {
      description: "Public capability catalogue",
      schema: publicCapabilityCatalogueResponseSchema,
    },
  },
  handler: async () => ({
    experiences: getProjectExperienceCatalog(),
    modelTools: MODEL_TOOL_DEFINITIONS,
    tools: listCatalogueTools(),
    recipes: listRecipeCatalogueSummaries(),
  }),
  cache: { maxAge: 1800, staleWhileRevalidate: 3600 },
});

addRoute(app, "get", "/remote_apps", {
  tags: ["capabilities"],
  summary: "List apps from connected MCP servers",
  description:
    "Returns the MCP Apps the caller's connected MCP servers offer as standalone apps. A server that cannot be reached is left out.",
  auth: true,
  responses: {
    200: { description: "Remote apps", schema: remoteAppListResponseSchema },
  },
  handler: async ({ serviceContext }) => ({ apps: await listRemoteApps(serviceContext) }),
});

addRoute(app, "put", "/apps/:app_id", {
  tags: ["capabilities"],
  summary: "Turn one of your apps on or off",
  description:
    "Saves whether a bundled app or an app from one of the caller's MCP servers shows as on in the caller's personal catalogue and can be opened. Apps are on until turned off.",
  auth: true,
  paramSchema: appSettingsParamsSchema,
  bodySchema: appSettingsSchema,
  responses: {
    200: { description: "The saved setting", schema: appSettingsResponseSchema },
  },
  handler: ({ serviceContext, params, body }) =>
    setAppEnabled(serviceContext, params.app_id, body.enabled),
});

app.use("/remote_app_views", requirePlan("pro"));

addRoute(app, "post", "/remote_app_views", {
  tags: ["capabilities"],
  summary: "Open an app from a connected MCP server",
  description:
    "Runs the read-only tool a connected MCP server marks as an app entry point and returns its view, fetched here so the page never speaks to the server itself.",
  auth: true,
  bodySchema: mcpAppEntryOpenRequestSchema,
  responses: { 200: { description: "The app view", schema: mcpAppViewSchema } },
  handler: ({ serviceContext, body }) => openRemoteApp(serviceContext, body),
});

export default app;
