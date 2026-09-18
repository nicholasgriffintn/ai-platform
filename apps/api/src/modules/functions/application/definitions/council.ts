import { councilMemberIds } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

export const MAX_COUNCIL_MEMBERS = 6;
export const MAX_COUNCIL_TURNS = 8;

export const select_council_members: FunctionToolDescriptor = {
  name: "select_council_members",
  description:
    "Ask the user which council members should debate their question. Renders a picker in the conversation, pre-ticked with the members you recommend. Call this before run_council whenever the user has not already named the members they want, then convene the council with what they choose.",
  type: "normal",
  permissions: ["human"],
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .max(4000)
      .describe("The question the council would debate, so the picker can show what is at stake."),
    recommended: z
      .array(z.enum(councilMemberIds))
      .max(MAX_COUNCIL_MEMBERS)
      .optional()
      .describe(
        "Members to pre-tick. Choose perspectives that genuinely disagree about this question. Defaults to sceptic, architect, strategist, synthesiser.",
      ),
    reason: z
      .string()
      .max(280)
      .optional()
      .describe("One short line on why you recommend those members. Shown above the picker."),
  }),
};

export const run_council: FunctionToolDescriptor = {
  name: "run_council",
  description:
    "Convene a council of named perspectives to debate one question. Each member answers in its own completion using the conversation's model, reading what came before, and each turn chooses who speaks next until the chamber converges. Turns appear in the conversation as they happen. Use for genuinely contested decisions and designs, not for questions with a retrievable answer.",
  type: "normal",
  permissions: ["orchestration"],
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .max(4000)
      .describe("The question the council should debate, stated in full."),
    memberIds: z
      .array(z.enum(councilMemberIds))
      .max(MAX_COUNCIL_MEMBERS)
      .optional()
      .describe(
        "Members to convene. Choose perspectives that genuinely disagree about this question. Defaults to sceptic, architect, strategist, synthesiser.",
      ),
    maxTurns: z
      .number()
      .int()
      .min(2)
      .max(MAX_COUNCIL_TURNS)
      .optional()
      .describe(
        `Upper bound on debate turns before the council must conclude. Defaults to ${MAX_COUNCIL_TURNS}.`,
      ),
  }),
};
