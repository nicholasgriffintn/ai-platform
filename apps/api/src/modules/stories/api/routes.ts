import {
  errorResponseSchema,
  storyPageSchema,
  storyParamsSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { readStoryPage } from "~/modules/stories/application/read-models";

const app = new Hono();

addRoute(app, "get", "/:story_id", {
  tags: ["stories"],
  summary: "Read a story",
  description:
    "A shared story: its latest overview, each outlet's angle and the articles it joins.",
  auth: true,
  paramSchema: storyParamsSchema,
  responses: {
    200: { description: "The story", schema: storyPageSchema },
    404: { description: "No such story", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) => readStoryPage(serviceContext.env, params.story_id),
});

export default app;
