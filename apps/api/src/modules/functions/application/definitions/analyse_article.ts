import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const analyseArticleInputSchema = z.object({
  itemId: z
    .string()
    .min(1)
    .max(200)
    .describe("Identifier for this article, used to group its analysis with the same source."),
  article: z
    .string()
    .min(1)
    .max(120_000)
    .describe("The article text to analyse. Extract it first if you were only given a link."),
});

export const analyse_article: FunctionToolDescriptor = {
  name: "analyse_article",
  description:
    "Analyse one article for its claims, framing and reliability, and keep the analysis as a durable result the user can find again in Files. Use it when someone asks what an article actually says or how far to trust it.",
  type: "premium",
  permissions: ["reasoning", "write"],
  inputSchema: analyseArticleInputSchema,
};
