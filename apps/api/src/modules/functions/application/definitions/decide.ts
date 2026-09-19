import { decisionQuestionsSchema, decisionStateSchema } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const decide: FunctionToolDescriptor = {
  name: "decide",
  description:
    "Ask a fast decision model (TypeSafe Jev) typed questions about some text or structured state and get calibrated probabilities back in a single call. Use it to classify, rate, rank, verify or gate before acting: routing a request, checking whether a message is urgent, scoring several candidates on the same rubric, or confirming a statement is supported by evidence. It never writes text. Put every question you might need in one call; questions are independent and evaluated in parallel. Question types: choice (pick one of named options), score (position along ordered levels), noul (probability a statement is true). Reference parts of a structured state with backticked paths in the instructions, such as `ticket.message`.",
  type: "normal",
  permissions: ["read"],
  inputSchema: z.object({
    state: decisionStateSchema.describe(
      "The content to judge: a string, a JSON object with named fields, or an array of text.",
    ),
    questions: decisionQuestionsSchema.describe(
      "Map of question id to question. choice needs criteria as an object of option name to description (null is fine); score needs criteria as an ordered array of 2 to 10 level descriptions from low to high; noul optionally takes criteria with true and false descriptions.",
    ),
  }),
};
