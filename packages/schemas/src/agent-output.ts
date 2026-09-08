import z from "zod/v4";

const contentSchema = z.union([
  z.string(),
  z.array(z.object({ type: z.string(), text: z.string().optional() })),
]);
const grokResultSchema = z.object({
  text: z.string(),
  stopReason: z.string(),
  sessionId: z.string(),
  requestId: z.string(),
});
const assistantOutputSchema = z.object({
  type: z.string().optional(),
  is_error: z.boolean().optional(),
  result: z.string().optional(),
  error: z.object({ message: z.string() }).optional(),
  item: z.object({ type: z.string(), text: z.string().optional() }).optional(),
  part: z.object({ text: z.string().optional() }).optional(),
  message: z.object({ content: contentSchema.optional() }).optional(),
  method: z.string().optional(),
  params: z
    .object({
      update: z.object({
        sessionUpdate: z.string(),
        content: z.object({ text: z.string().optional() }).optional(),
      }),
    })
    .optional(),
});

export function readAssistantOutput(line: string): { text?: string; error?: string } {
  let raw: unknown;

  try {
    raw = JSON.parse(line);
  } catch {
    return {};
  }

  const grokResult = grokResultSchema.safeParse(raw);

  if (grokResult.success) {
    return { text: grokResult.data.text };
  }

  const parsed = assistantOutputSchema.safeParse(raw);

  if (!parsed.success) {
    return {};
  }

  const event = parsed.data;

  if (event.type === "error" || event.type === "turn.failed" || event.is_error) {
    return {
      error: event.error?.message ?? event.result ?? "The agent could not complete this turn.",
    };
  }

  if (event.type === "item.completed" && event.item?.type === "agent_message") {
    return { text: event.item.text };
  }

  if (event.type === "text") {
    return { text: event.part?.text };
  }

  if (event.type === "assistant") {
    const content = event.message?.content;

    return {
      text:
        typeof content === "string"
          ? content
          : content
              ?.filter((part) => part.type === "text")
              .map((part) => part.text ?? "")
              .join(""),
    };
  }

  if (
    event.method === "session/update" &&
    event.params?.update.sessionUpdate === "agent_message_chunk"
  ) {
    return { text: event.params.update.content?.text };
  }

  return {};
}
