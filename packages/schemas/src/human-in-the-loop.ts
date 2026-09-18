import z from "zod/v4";

import { userQuestionAnswerSchema, userQuestionSchema } from "./user-questions.js";

export const humanInTheLoopTypeSchema = z.enum(["approval", "question", "selection", "takeover"]);

export const humanInTheLoopStatusSchema = z.enum([
  "pending",
  "resolved",
  "expired",
  "approved",
  "rejected",
  "consumed",
  "interrupted",
]);

export const humanInTheLoopResolutionSchema = z.enum(["approved", "rejected"]);

const humanInTheLoopBaseShape = {
  status: humanInTheLoopStatusSchema,
  requires_user_action: z.boolean(),
  interactionId: z.string().min(1).optional(),
  toolName: z.string().min(1).optional(),
};

export const approvalHumanInTheLoopSchema = z
  .object({
    ...humanInTheLoopBaseShape,
    type: z.literal("approval"),
    message: z.string().optional(),
    options: z.array(z.string()).optional(),
    resolution: humanInTheLoopResolutionSchema.optional(),
    resolvedAt: z.string().optional(),
    consumedAt: z.string().optional(),
  })
  .catchall(z.unknown());

export const questionHumanInTheLoopSchema = z
  .object({
    ...humanInTheLoopBaseShape,
    type: z.literal("question"),
    questions: z.array(userQuestionSchema).min(1),
    answers: z.array(userQuestionAnswerSchema).optional(),
  })
  .catchall(z.unknown());

export const selectionHumanInTheLoopSchema = z
  .object({
    ...humanInTheLoopBaseShape,
    type: z.literal("selection"),
  })
  .catchall(z.unknown());

export const takeoverHumanInTheLoopSchema = z
  .object({
    ...humanInTheLoopBaseShape,
    type: z.literal("takeover"),
  })
  .catchall(z.unknown());

export const humanInTheLoopSchema = z.discriminatedUnion("type", [
  approvalHumanInTheLoopSchema,
  questionHumanInTheLoopSchema,
  selectionHumanInTheLoopSchema,
  takeoverHumanInTheLoopSchema,
]);

export type HumanInTheLoopType = z.infer<typeof humanInTheLoopTypeSchema>;
export type HumanInTheLoopStatus = z.infer<typeof humanInTheLoopStatusSchema>;
export type HumanInTheLoopResolution = z.infer<typeof humanInTheLoopResolutionSchema>;
export type ApprovalHumanInTheLoop = z.infer<typeof approvalHumanInTheLoopSchema>;
export type QuestionHumanInTheLoop = z.infer<typeof questionHumanInTheLoopSchema>;
export type SelectionHumanInTheLoop = z.infer<typeof selectionHumanInTheLoopSchema>;
export type TakeoverHumanInTheLoop = z.infer<typeof takeoverHumanInTheLoopSchema>;
export type HumanInTheLoop = z.infer<typeof humanInTheLoopSchema>;
