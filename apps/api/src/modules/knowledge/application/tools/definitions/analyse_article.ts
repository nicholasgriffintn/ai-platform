import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const analyseArticleInputSchema = z.object({
  title: z.string().trim().min(1).max(200).describe("What the article is called."),
  article: z
    .string()
    .min(1)
    .max(120_000)
    .describe("The article text to analyse. Extract it first if you were only given a link."),
  url: z.url().max(2048).optional().describe("Where the article came from, when you know."),
});

export const analyse_article: FunctionToolDescriptor = {
  name: "analyse_article",
  description:
    "Files one article in Files and reads how it is framed: slant, tone, sourcing, loaded wording and what it leaves out. Use it when someone asks how far to trust a piece, or wants it kept to come back to.",
  type: "premium",
  permissions: ["reasoning", "write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({ operation: "analyse_article", title: input.title }),
  inputSchema: analyseArticleInputSchema,
};
