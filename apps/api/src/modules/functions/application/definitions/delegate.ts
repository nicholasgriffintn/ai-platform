import { DELEGATION_MAX_FAN_OUT } from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

const inlineTeammateSchema = z.object({
  role_slug: z.string().min(1).optional(),
  job_description: z.string().trim().min(1).max(2000).optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

const delegationBudgetInputSchema = z.object({
  max_credit_micros: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  max_steps: z.number().int().positive().max(1000).default(20),
  deadline: z.iso.datetime().optional(),
});

export const delegateInputSchema = z
  .object({
    teammate_id: z.string().min(1).optional(),
    teammate: inlineTeammateSchema.optional(),
    goal: z.string().trim().min(1).max(2000),
    wait_for: z.enum(["all", "any", "none"]).default("none"),
    budget: delegationBudgetInputSchema.optional(),
    child_conversation_id: z.string().min(1).optional(),
    continuation_mode: z.enum(["resume", "fresh"]).optional(),
    memory_bindings: z
      .array(
        z.object({
          document_id: z.string().min(1),
          access: z.enum(["read", "read-write"]).default("read"),
        }),
      )
      .max(20)
      .optional(),
  })
  .refine((input) => Boolean(input.teammate_id || input.teammate), {
    error: "Choose a saved teammate or describe the teammate to hire",
  })
  .refine((input) => !(input.teammate_id && input.teammate), {
    error: "Choose either a saved teammate or an inline teammate",
  })
  .refine((input) => !input.continuation_mode || Boolean(input.child_conversation_id), {
    error: "Choose a child conversation before selecting how to continue it",
  });

export type DelegateInput = z.infer<typeof delegateInputSchema>;

export const delegate: FunctionToolDescriptor = {
  name: "delegate",
  description: `Ask a teammate to do a job in its own conversation and report back. It runs in the background with a bounded budget and at most ${DELEGATION_MAX_FAN_OUT} children in flight.`,
  type: "normal",
  permissions: ["delegate"],
  inputSchema: delegateInputSchema,
};
