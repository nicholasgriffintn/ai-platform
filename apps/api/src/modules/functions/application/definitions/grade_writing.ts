import z from "zod/v4";

import { MAX_GRADED_CHARS } from "~/config/limits";

import type { FunctionToolDescriptor } from "./types";

export const grade_writing = {
  name: "grade_writing",
  description:
    "Score a piece of writing against an editorial rubric and get calibrated scores back in one call: clarity, specificity, claim support, structure and usefulness, plus a weighted overall grade from A to E. Use it to review a draft, compare two versions, or check a page before publishing. It scores the writing, not its author, and it never rewrites the text. The result is an editorial opinion, not a measure of whether the writing is correct or whether a person or a model wrote it.",
  type: "normal",
  permissions: ["read"],
  effects: { effectClass: "read" },
  inputSchema: z.object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(MAX_GRADED_CHARS)
      .describe("The writing to grade. Paste the prose itself, not a link to it."),
  }),
} satisfies FunctionToolDescriptor;
