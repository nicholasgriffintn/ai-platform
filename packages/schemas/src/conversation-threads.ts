import z from "zod/v4";

export const conversationThreadSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  parent_conversation_id: z.string().nullable(),
  created_at: z.string(),
  is_archived: z.boolean(),
});
export const conversationThreadsResponseSchema = z.object({
  threads: z.array(conversationThreadSchema),
  truncated: z.boolean(),
});
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
export type ConversationThreadsResponse = z.infer<typeof conversationThreadsResponseSchema>;

export function flattenConversationThreads(threads: ConversationThread[]) {
  const ids = new Set(threads.map((thread) => thread.id));
  const children = new Map<string | null, ConversationThread[]>();

  for (const thread of threads) {
    const parent =
      thread.parent_conversation_id && ids.has(thread.parent_conversation_id)
        ? thread.parent_conversation_id
        : null;
    const siblings = children.get(parent) ?? [];

    siblings.push(thread);
    children.set(parent, siblings);
  }

  const result: Array<ConversationThread & { depth: number }> = [];
  const visited = new Set<string>();
  const stack = [...(children.get(null) ?? [])].reverse().map((thread) => ({ thread, depth: 0 }));

  // Disconnected or cyclic legacy records still remain navigable once each.
  for (const thread of threads) {
    if (stack.length === 0 && !visited.has(thread.id)) {
      stack.push({ thread, depth: 0 });
    }

    while (stack.length) {
      const entry = stack.pop();

      if (!entry || visited.has(entry.thread.id)) {
        continue;
      }

      visited.add(entry.thread.id);
      result.push({ ...entry.thread, depth: entry.depth });
      for (const child of [...(children.get(entry.thread.id) ?? [])].reverse()) {
        stack.push({ thread: child, depth: entry.depth + 1 });
      }
    }
  }

  return result;
}
