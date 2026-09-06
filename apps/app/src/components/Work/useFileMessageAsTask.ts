import { useState } from "react";
import { toast } from "sonner";

import { useProjectTasks } from "~/hooks/useProjectTasks";
import { getErrorMessage } from "~/lib/errors";

export function useFileMessageAsTask({
  projectId,
  conversationId,
}: {
  projectId: string;
  conversationId?: string;
}) {
  const [isEnabled, setIsEnabled] = useState(false);
  const { create } = useProjectTasks(projectId);

  return {
    isEnabled,
    setIsEnabled,
    isFiling: create.isPending,
    file: async (objective: string) => {
      try {
        const { task } = await create.mutateAsync({
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
  };
}
