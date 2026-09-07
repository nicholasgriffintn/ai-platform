import { useProjectTasks, getErrorMessage } from "@ngriffin_uk/polychat-library-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

export function useFileMessageAsTask({
  projectId,
  conversationId,
}: {
  projectId: string;
  conversationId?: string;
}) {
  const [isEnabled, setIsEnabled] = useState(false);
  const { create } = useProjectTasks(projectId);
  const { mutateAsync } = create;
  const isFiling = create.isPending;

  const file = useCallback(
    async (objective: string) => {
      try {
        const { task } = await mutateAsync({
          objective,
          ...(conversationId ? { originConversationId: conversationId } : {}),
        });

        toast.success(`Filed "${task.objective}" as a task`);
        setIsEnabled(false);

        return true;
      } catch (error) {
        toast.error(getErrorMessage(error, "Unable to file this as a task"));

        return false;
      }
    },
    [conversationId, mutateAsync],
  );

  return useMemo(() => ({ isEnabled, setIsEnabled, isFiling, file }), [file, isEnabled, isFiling]);
}
