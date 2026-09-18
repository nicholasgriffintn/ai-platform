import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const MAX_REVIEWERS = 4;
export const MAX_SOURCE_LENGTH = 12000;

export const second_opinion: FunctionToolDescriptor = {
  name: "second_opinion",
  description:
    "Put the answer you just gave in front of other models and report what they say. Each reviewer answers in its own completion on its own model, reads what earlier reviewers said, and the panel concludes with the answer to trust. Use when the user asks for a second opinion, a consensus, a sanity check, or whether an answer can be trusted; not for questions with a retrievable answer.",
  type: "premium",
  permissions: ["orchestration"],
  inputSchema: z.object({
    models: z
      .array(z.string().min(1))
      .min(1)
      .max(MAX_REVIEWERS)
      .describe(
        "Model ids to review the answer. Pick models that differ from the one that answered, and from each other.",
      ),
    answer: z
      .string()
      .max(MAX_SOURCE_LENGTH)
      .optional()
      .describe(
        "The answer to review. Leave this out to review the last assistant message in this conversation, which is the usual case.",
      ),
    focus: z
      .string()
      .max(280)
      .optional()
      .describe("What the user wants checked, if they said. Shown to every reviewer."),
  }),
};
