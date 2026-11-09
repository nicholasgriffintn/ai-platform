import {
  coverageTrackerQuerySchema,
  coverageTrackerSchema,
  entityPageSchema,
  entityParamsSchema,
  errorResponseSchema,
  storyPageSchema,
  storyParamsSchema,
  storyReclusterResponseSchema,
  storyWorldSchema,
} from "@ngriffin_uk/polychat-schemas";
import { Hono } from "hono";

import { addRoute } from "~/infrastructure/http/routeBuilder";
import { readCoverageTracker } from "~/modules/stories/application/coverage";
import { queueStoryRecluster } from "~/modules/stories/application/intake";
import { readEntityPage, readStoryPage } from "~/modules/stories/application/read-models";
import { snapshotStoryFacts } from "~/modules/stories/application/recluster";
import { readStoryWorld } from "~/modules/stories/application/world";

const app = new Hono();

addRoute(app, "get", "/tracker", {
  tags: ["stories"],
  summary: "Read the coverage tracker",
  description:
    "Topic share by week, an outlet by topic attention map, open stories that lost coverage this week and term trends, from the daily coverage roll-ups.",
  auth: true,
  querySchema: coverageTrackerQuerySchema,
  responses: { 200: { description: "The coverage tracker", schema: coverageTrackerSchema } },
  handler: async ({ serviceContext, query }) => readCoverageTracker(serviceContext.env, query),
});

addRoute(app, "post", "/recluster", {
  tags: ["stories"],
  summary: "Recluster stories in development",
  description:
    "Development only: clears the local story graph and re-ingests every article fact in published order.",
  auth: true,
  responses: {
    200: { description: "Recluster queued", schema: storyReclusterResponseSchema },
    404: { description: "Not available outside development", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext }) => {
    await queueStoryRecluster(
      serviceContext.env,
      await snapshotStoryFacts(serviceContext.env),
      new Date(),
    );

    return { status: "queued" as const };
  },
});

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

addRoute(app, "get", "/:story_id/world", {
  tags: ["stories"],
  summary: "Find a story in your own chats, notebooks and memories",
  description:
    "Your personal chats, notebook sources and memories that mention the people and organisations in a story.",
  auth: true,
  paramSchema: storyParamsSchema,
  responses: {
    200: { description: "Your related material", schema: storyWorldSchema },
    404: { description: "No such story", schema: errorResponseSchema },
  },
  handler: async ({ serviceContext, params }) => readStoryWorld(serviceContext, params.story_id),
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
