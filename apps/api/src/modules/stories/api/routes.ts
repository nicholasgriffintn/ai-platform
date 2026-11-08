import {
  entityPageSchema,
  entityParamsSchema,
  errorResponseSchema,
  storyPageSchema,
  storyParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { readEntityPage, readStoryPage } from "~/modules/stories/application/read-models";

const app = new Hono();

addRoute(app, "get", "/entities/:entity_id", {
  tags: ["stories"],
  summary: "Read a person, organisation, place or product",
  description: "The stories that involve an entity over time, and quotes attributed to it.",
  auth: true,
  paramSchema: entityParamsSchema,
  responses: {
    200: { description: "The entity", schema: entityPageSchema },
    404: { description: "No such entity", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) =>
    readEntityPage(serviceContext.env, params.entity_id),
});

addRoute(app, "get", "/:story_id", {
  tags: ["stories"],
  summary: "Read a story",
  description:
    "A shared story: its latest overview, each outlet's angle, verified quotes, who is involved, earlier stories it continues and the articles it joins.",
  auth: true,
  paramSchema: storyParamsSchema,
  responses: {
    200: { description: "The story", schema: storyPageSchema },
    404: { description: "No such story", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) => readStoryPage(serviceContext.env, params.story_id),
});

export default app;
