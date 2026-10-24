import { ownsResource } from "@ngriffin_uk/polychat-library-policy";

export function groupMatchesConversationScope(
  group: { owner_user_id: number | null; project_id: string | null },
  conversation: { userId: number; projectId: string | null },
): boolean {
  return conversation.projectId
    ? group.project_id === conversation.projectId
    : group.project_id === null && ownsResource(conversation.userId, group.owner_user_id);
}
