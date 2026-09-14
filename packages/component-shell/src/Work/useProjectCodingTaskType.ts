import type { Conversation } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import { type SandboxTaskType, sandboxTaskTypeSchema } from "@ngriffin_uk/polychat-schemas";
import { useCallback, useEffect, useRef, useState } from "react";

export function useProjectCodingTaskType({
  projectId,
  currentConversationId,
  currentConversation,
}: {
  projectId: string;
  currentConversationId?: string | null;
  currentConversation?: Conversation | null;
}) {
  const [draftTaskType, setDraftTaskType] = useState<SandboxTaskType>("feature-implementation");
  const [taskTypesByConversation, setTaskTypesByConversation] = useState<
    Record<string, SandboxTaskType>
  >({});
  const [prevProjectId, setPrevProjectId] = useState(projectId);
  const previousConversationIdRef = useRef<string | null>(null);
  const taskType = currentConversationId
    ? (taskTypesByConversation[currentConversationId] ?? draftTaskType)
    : draftTaskType;

  if (prevProjectId !== projectId) {
    setPrevProjectId(projectId);
    setDraftTaskType("feature-implementation");
    setTaskTypesByConversation({});
  }

  useEffect(() => {
    if (!currentConversationId) {
      previousConversationIdRef.current = null;

      return;
    }

    if (previousConversationIdRef.current && !taskTypesByConversation[currentConversationId]) {
      setDraftTaskType("feature-implementation");
    }

    previousConversationIdRef.current = currentConversationId;
  }, [currentConversationId, taskTypesByConversation]);

  const persistedTaskType = [...(currentConversation?.messages ?? [])]
    .reverse()
    .map((message) => sandboxTaskTypeSchema.safeParse(message.data?.codingTaskType))
    .find((result) => result.success)?.data;
  const [prevPersistedConversation, setPrevPersistedConversation] = useState(currentConversation);
  const [prevPersistedConversationId, setPrevPersistedConversationId] =
    useState(currentConversationId);

  if (
    prevPersistedConversation !== currentConversation ||
    prevPersistedConversationId !== currentConversationId
  ) {
    setPrevPersistedConversation(currentConversation);
    setPrevPersistedConversationId(currentConversationId);

    if (currentConversationId && persistedTaskType) {
      setTaskTypesByConversation((current) => ({
        ...current,
        [currentConversationId]: persistedTaskType,
      }));
    }
  }

  const handleTaskTypeChange = useCallback(
    (nextTaskType: SandboxTaskType) => {
      if (currentConversationId) {
        setTaskTypesByConversation((current) => ({
          ...current,
          [currentConversationId]: nextTaskType,
        }));

        return;
      }

      setDraftTaskType(nextTaskType);
    },
    [currentConversationId],
  );

  return { taskType, handleTaskTypeChange };
}
