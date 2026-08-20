import z from "zod/v4";

import { retrieveHackerNewsTopStories } from "~/services/apps/retrieval/hackernews";

import type { ApiToolDefinition } from "../../types/functions";

export const get_hacker_news_stories: ApiToolDefinition = {
  name: "get_hacker_news_stories",
  description:
    "Retrieve the current top stories from the Hacker News front page as titles and links. Returns data only; interpret it yourself.",
  type: "normal",
  costPerCall: 0.1,
  permissions: ["read"],
  inputSchema: z.object({
    count: z
      .number()
      .int()
      .min(1)
      .max(30)
      .default(10)
      .describe("How many front-page stories to return."),
  }),
  execute: async (args, context) => {
    const request = context.request;
    const stories = await retrieveHackerNewsTopStories({
      count: Number(args.count) || 10,
      env: request.env,
      user: request.user,
    });

    if (stories.length === 0) {
      return {
        status: "error",
        name: "get_hacker_news_stories",
        content: "No Hacker News stories could be retrieved.",
        data: { stories: [] },
      };
    }

    return {
      status: "success",
      name: "get_hacker_news_stories",
      content: stories
        .map((story, index) => `${index + 1}. ${story.title} — ${story.link}`)
        .join("\n"),
      data: { stories },
    };
  },
};
