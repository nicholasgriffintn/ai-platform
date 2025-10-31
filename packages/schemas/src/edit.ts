import z from "zod/v4";

import { messageSchema } from "./shared";
import { chatCompletionResponseSchema } from "./chat";

const editRequestBase = z.object({
  model: z
    .string()
    .optional()
    .describe("The Mercury model to use for the edit operation."),
  messages: z
    .array(messageSchema)
    .min(1)
    .describe(
      "Conversation-style inputs providing the current file state and instructions for the edit.",
    ),
  stream: z
    .boolean()
    .optional()
    .describe("Whether to stream the edit response as server-sent events."),
});

export const nextEditRequestSchema = editRequestBase;
export const applyEditRequestSchema = editRequestBase;

export const editCompletionResponseSchema = chatCompletionResponseSchema;
