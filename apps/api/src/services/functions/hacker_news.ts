import { retrieveHackerNewsTopStories } from "~/services/apps/retrieval/hackernews";

import type { ApiToolDefinition } from "../../types/functions";
import { get_hacker_news_stories as get_hacker_news_storiesDescriptor } from "./definitions/hacker_news";

export const get_hacker_news_stories: ApiToolDefinition = {
  ...get_hacker_news_storiesDescriptor,
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
