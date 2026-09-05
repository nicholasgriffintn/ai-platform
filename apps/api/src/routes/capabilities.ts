import {
  capabilityCatalogResponseSchema,
  publicCapabilityCatalogueResponseSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { listScopedAgentSummaries } from "~/services/agents";
import { listRecipeCatalogueSummaries } from "~/services/apps/recipes";
import { getProjectExperienceCatalog, MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { listScopedSkillSummaries } from "~/services/skills";
import { listCatalogueTools } from "~/services/tools/toolsOperations";

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
    "Returns the agents, rich experiences, model tools and skills a project or person can enable. Function tools are published by /tools.",
  auth: "user-or-anonymous",
  querySchema: z.object({ projectId: z.string().min(1).optional() }),
  responses: {
    200: { description: "Capability catalogue", schema: capabilityCatalogResponseSchema },
  },
  handler: async ({ query, serviceContext, user }) => {
    const [agents, skills] = await Promise.all([
      listScopedAgentSummaries(serviceContext, user?.id, query.projectId),
      listScopedSkillSummaries(serviceContext, user?.id, query.projectId),
    ]);

    return {
      agents,
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
});

export default app;
