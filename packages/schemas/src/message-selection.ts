import z from "zod/v4";

export const chatMessageSelectionSourceSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("artifact"),
      identifier: z.string().min(1),
      type: z.string().min(1),
      title: z.string().optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("message"),
      messageId: z.string().min(1),
      role: z.enum(["user", "assistant"]),
      runId: z.string().min(1).optional(),
    })
    .strict(),
]);

export const chatMessageSelectionSchema: z.ZodType<ChatMessageSelection> = z
  .object({
    source: chatMessageSelectionSourceSchema,
    selectedText: z.string().trim().min(1),
    comment: z.string().trim().min(1).optional(),
  })
  .strict();

export type ChatMessageSelectionSource =
  | {
      kind: "artifact";
      identifier: string;
      type: string;
      title?: string;
    }
  | {
      kind: "message";
      messageId: string;
      role: "user" | "assistant";
      runId?: string;
    };

export type ChatMessageSelection = {
  source: ChatMessageSelectionSource;
  selectedText: string;
  comment?: string;
};
