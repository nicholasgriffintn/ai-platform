import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const get_hacker_news_stories: FunctionToolDescriptor = {
  name: "get_hacker_news_stories",
  description:
    "Retrieve the current top stories from the Hacker News front page as titles and links. Returns data only; interpret it yourself.",
  type: "normal",
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
};
