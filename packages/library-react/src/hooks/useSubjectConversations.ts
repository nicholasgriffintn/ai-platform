import { apiService } from "@ngriffin_uk/polychat-library-client";
import type { ConversationSubject } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";

export const subjectConversationsQueryKey = (subject: ConversationSubject) =>
  ["subjectConversations", subject.type, subject.id] as const;

export function useSubjectConversations(subject: ConversationSubject | null) {
  return useQuery({
    queryKey: subject ? subjectConversationsQueryKey(subject) : ["subjectConversations", "none"],
    queryFn: () =>
      subject
        ? apiService.listSubjectConversations(subject)
        : Promise.reject(new Error("No subject")),
    enabled: Boolean(subject),
  });
}
