import z from "zod/v4";

import { hasUniqueValues } from "./collection-validation";

export const USER_QUESTION_SET_MAX_QUESTIONS = 3;
export const USER_QUESTION_MAX_OPTIONS = 5;

export const userQuestionOptionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(240).nullable().default(null),
});

export const userQuestionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, "Question ids are lowercase and use - or _ as separators"),
  prompt: z.string().trim().min(1).max(500),
  options: z.array(userQuestionOptionSchema).max(USER_QUESTION_MAX_OPTIONS).default([]),
  allowOther: z.boolean().default(true),
});

export const userQuestionsSchema = z
  .array(userQuestionSchema)
  .min(1)
  .max(USER_QUESTION_SET_MAX_QUESTIONS)
  .refine((questions) => hasUniqueValues(questions.map((question) => question.id)), {
    error: "Question ids must be unique",
  });

export const userQuestionSetSchema = z.object({
  interactionId: z.string().min(1),
  questions: userQuestionsSchema,
  requestedAt: z.string(),
});

export const userQuestionAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().trim().min(1).max(2000),
});

export const answerUserQuestionsSchema = z.object({
  interactionId: z.string().min(1),
  answers: z.array(userQuestionAnswerSchema).min(1).max(USER_QUESTION_SET_MAX_QUESTIONS),
});

export type UserQuestionOption = z.infer<typeof userQuestionOptionSchema>;
export type UserQuestion = z.infer<typeof userQuestionSchema>;
export type UserQuestionSet = z.infer<typeof userQuestionSetSchema>;
export type AnswerUserQuestionsInput = z.infer<typeof answerUserQuestionsSchema>;
