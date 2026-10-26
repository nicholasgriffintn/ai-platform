import {
  capabilityCatalogResponseSchema,
  publicCapabilityCatalogueResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
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
    const [teammates, skills] = await Promise.all([
      listScopedTeammateSummaries(serviceContext, user?.id, query.project_id),
      listScopedSkillSummaries(serviceContext, user?.id, query.project_id),
    ]);

    return {
      teammates,
      experiences: getProjectExperienceCatalog(),
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

export default app;
