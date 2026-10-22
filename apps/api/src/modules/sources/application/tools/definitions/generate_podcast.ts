import { podcastFormatSchema, podcastLengthSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

export const generatePodcastInputSchema = z.object({
  source_ids: z
    .array(z.string().min(1))
    .max(20)
    .optional()
    .describe("Sources the episode should discuss. Find them with search_documents first."),
  material: z
    .string()
    .trim()
    .min(1)
    .max(100_000)
    .optional()
    .describe(
      "Research to discuss when it is not already a source, such as findings from a web search. It is saved as a text source.",
    ),
  title: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional()
    .describe("Episode title. Omit to let the hosts name it."),
  focus: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .describe("What the hosts should concentrate on or who the listener is."),
  format: podcastFormatSchema
    .optional()
    .describe("deep_dive (default), brief, debate or critique."),
  length: podcastLengthSchema.optional().describe("short, default or long."),
  show: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional()
    .describe("Podcast show to publish the episode in. Created when it does not exist yet."),
});

export const generate_podcast: FunctionToolDescriptor = {
  name: "generate_podcast",
  description:
    "Turn sources or research into a two-host audio episode that is saved in Sources, with a transcript, show notes and cover art. Episodes in a show appear in its private RSS feed. Generation runs in the background and takes a few minutes.",
  type: "premium",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({ operation: "generate_podcast", ...input }),
  inputSchema: generatePodcastInputSchema,
};
