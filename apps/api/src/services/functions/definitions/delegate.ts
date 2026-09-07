import {
  DELEGATION_DEFAULT_TOKEN_BUDGET,
  DELEGATION_MAX_FAN_OUT,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "./types";

const inlineTeammateSchema = z.object({
  role_slug: z.string().min(1).optional(),
  job_description: z.string().trim().min(1).max(2000).optional(),
  name: z.string().trim().min(1).max(120).optional(),
});

const delegationBudgetInputSchema = z.object({
  max_credit_micros: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .default(DELEGATION_DEFAULT_TOKEN_BUDGET),
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
  })
  .refine((input) => Boolean(input.teammate_id || input.teammate), {
    error: "Choose a saved teammate or describe the teammate to hire",
  })
  .refine((input) => !(input.teammate_id && input.teammate), {
    error: "Choose either a saved teammate or an inline teammate",
  });

export type DelegateInput = z.infer<typeof delegateInputSchema>;

export const delegate: FunctionToolDescriptor = {
  name: "delegate",
  description: `Ask a teammate to do a job in its own conversation and report back. It runs in the background with a bounded budget and at most ${DELEGATION_MAX_FAN_OUT} children in flight.`,
  type: "normal",
  permissions: ["delegate"],
  inputSchema: delegateInputSchema,
};
