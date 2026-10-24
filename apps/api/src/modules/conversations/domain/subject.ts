import { type ConversationSubject, conversationSubjectSchema } from "@ngriffin_uk/polychat-schemas";

export function readStoredSubject(
  conversation: Record<string, unknown> | null | undefined,
): ConversationSubject | null {
  const parsed = conversationSubjectSchema.safeParse({
    type: conversation?.subject_type,
    id: conversation?.subject_id,
  });

  return parsed.success ? parsed.data : null;
}
