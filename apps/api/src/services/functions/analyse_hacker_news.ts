import {
  analyseHackerNewsStories,
  retrieveHackerNewsTopStories,
} from "~/services/apps/retrieval/hackernews";
import type { IFunction, IRequest } from "~/types";

export const analyse_hacker_news: IFunction = {
  name: "analyse_hacker_news",
  description: "Extracts and analyses the top stories from Hacker News today.",
  parameters: {
    type: "object",
    properties: {
      count: {
        type: "integer",
        description: "Number of top stories to analyse",
        default: 10,
      },
      character: {
        type: "string",
        description: "Character to analyse the stories with",
        enum: [
          "normal",
          "kermitthefrog",
          "gordonramsay",
          "davidattenborough",
          "clippy",
        ],
      },
    },
    required: ["count"],
  },
  type: "normal",
  costPerCall: 0.2,
  function: async (
    _completion_id: string,
    args: any,
    req: IRequest,
    _app_url?: string,
  ) => {
    const stories = await retrieveHackerNewsTopStories({
      count: args.count,
      env: req.env,
      user: req.user,
    });

    const aiResponse = await analyseHackerNewsStories({
      stories,
      env: req.env,
      user: req.user,
      character: args.character,
    });

    return {
      status: "success",
      name: "analyse_hacker_news",
      content:
        aiResponse.response ||
        "Content extracted but no summary could be generated",
      data: {
        analysis: {
          content: aiResponse.response,
          log_id: aiResponse.log_id,
          citations: aiResponse.citations,
          usage: aiResponse.usage,
          model: aiResponse.model,
        },
        stories,
      },
    };
  },
};
