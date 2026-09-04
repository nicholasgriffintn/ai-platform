import z from "zod/v4";

export const conversationBranchSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  parent_conversation_id: z.string().nullable(),
  created_at: z.string(),
  is_archived: z.boolean(),
});
export const conversationBranchesResponseSchema = z.object({
  branches: z.array(conversationBranchSchema),
  truncated: z.boolean(),
});
export type ConversationBranch = z.infer<typeof conversationBranchSchema>;
export type ConversationBranchesResponse = z.infer<typeof conversationBranchesResponseSchema>;

export function flattenConversationBranches(branches: ConversationBranch[]) {
  const ids = new Set(branches.map((branch) => branch.id));
  const children = new Map<string | null, ConversationBranch[]>();

  for (const branch of branches) {
    const parent =
      branch.parent_conversation_id && ids.has(branch.parent_conversation_id)
        ? branch.parent_conversation_id
        : null;
    const siblings = children.get(parent) ?? [];

    siblings.push(branch);
    children.set(parent, siblings);
  }

  const result: Array<ConversationBranch & { depth: number }> = [];
  const visited = new Set<string>();
  const stack = [...(children.get(null) ?? [])].reverse().map((branch) => ({ branch, depth: 0 }));

  // Disconnected or cyclic legacy records still remain navigable once each.
  for (const branch of branches) {
    if (stack.length === 0 && !visited.has(branch.id)) {
      stack.push({ branch, depth: 0 });
    }

    while (stack.length) {
      const entry = stack.pop();

      if (!entry || visited.has(entry.branch.id)) {
        continue;
      }

      visited.add(entry.branch.id);
      result.push({ ...entry.branch, depth: entry.depth });
      for (const child of [...(children.get(entry.branch.id) ?? [])].reverse()) {
        stack.push({ branch: child, depth: entry.depth + 1 });
      }
    }
  }

  return result;
}
