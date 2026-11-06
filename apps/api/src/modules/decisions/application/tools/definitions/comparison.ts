import { COMPARISON_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import { MAX_SOURCE_LENGTH } from "~/config/limits";
import type { FunctionToolDescriptor } from "~/types/functions";

export const compare_and_conclude: FunctionToolDescriptor = {
  name: COMPARISON_TOOL_NAME,
  system: true,
  description:
    "Put a question to other models independently, show where their answers agree and disagree with the answer already given, and conclude with one answer. Runs from the compare action on a chat reply.",
  type: "premium",
  permissions: ["orchestration"],
  effects: { effectClass: "read" },
  intentEvidence: (input) => ({ operation: COMPARISON_TOOL_NAME, question: input.question }),
  inputSchema: z.object({
    question: z.string().min(1).max(MAX_SOURCE_LENGTH).describe("The question that was answered."),
    answer: z.string().min(1).max(MAX_SOURCE_LENGTH).describe("The answer being compared."),
    context: z
      .string()
      .max(MAX_SOURCE_LENGTH)
      .optional()
      .describe("Earlier conversation the question depends on."),
    answerModel: z.string().optional().describe("The model that gave the answer."),
    answerProvider: z.string().optional().describe("The provider of that model."),
  }),
};
