import { globalSearchQuerySchema, globalSearchResponseSchema } from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/lib/http/routeBuilder";
import { searchPolychat } from "~/services/global-search";

const app = new Hono();

addRoute(app, "get", "/", {
  auth: true,
  tags: ["search"],
  summary: "Search across Polychat",
  description:
    "Returns the signed-in user's accessible conversations, workspaces, and projects. Capability catalogue results are merged by the web client.",
  querySchema: globalSearchQuerySchema,
  responses: { 200: { description: "Global search results", schema: globalSearchResponseSchema } },
  handler: ({ serviceContext, query }) => searchPolychat(serviceContext, query),
});

export default app;
