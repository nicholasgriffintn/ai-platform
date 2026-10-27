import { inboxEntriesFor } from "@ngriffin_uk/polychat-component-workspaces";
import { useTaskAttention, useWorkInbox } from "@ngriffin_uk/polychat-library-react";

export function useInboxNeedsYou(): number {
  const decisions = useWorkInbox();
  const tasks = useTaskAttention();

  return inboxEntriesFor("needs", decisions.data?.data ?? [], tasks.items).length;
}
