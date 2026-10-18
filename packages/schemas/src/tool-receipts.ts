import z from "zod/v4";

import { toolEffectClassSchema } from "./tool-effects.js";

export const toolReceiptOutcomeSchema = z.enum(["done", "drafted"]);

export type ToolReceiptOutcome = z.infer<typeof toolReceiptOutcomeSchema>;

export const toolReceiptSchema = z.object({
  effect: toolEffectClassSchema,
  tool: z.string().min(1),
  title: z.string().min(1),
  detail: z.string().min(1).optional(),
  destination: z.string().min(1).optional(),
  outcome: toolReceiptOutcomeSchema,
});

export type ToolReceipt = z.infer<typeof toolReceiptSchema>;

export const toolReceiptOverrideSchema = z.object({
  title: z.string().min(1).optional(),
  detail: z.string().min(1).optional(),
});

export type ToolReceiptOverride = z.infer<typeof toolReceiptOverrideSchema>;
