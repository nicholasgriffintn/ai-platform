import { capabilityCatalogResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";
import z from "zod/v4";

import { addRoute } from "~/lib/http/routeBuilder";
import { createRouteLogger } from "~/middleware/loggerMiddleware";
import { getProjectExperienceCatalog, MODEL_TOOL_DEFINITIONS } from "~/services/experiences/config";
import { listScopedSkillSummaries } from "~/services/skills";

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
    "Returns the rich experiences, model tools and skills a project or person can enable. Function tools are published by /tools.",
  auth: "user-or-anonymous",
  querySchema: z.object({ projectId: z.string().min(1).optional() }),
  responses: {
    200: { description: "Capability catalogue", schema: capabilityCatalogResponseSchema },
  },
  handler: async ({ query, serviceContext, user }) => ({
    experiences: getProjectExperienceCatalog(),
    modelTools: MODEL_TOOL_DEFINITIONS,
    skills: await listScopedSkillSummaries(serviceContext, user?.id, query.projectId),
  }),
});

export default app;
