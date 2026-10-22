import { useProjectTasks } from "@ngriffin_uk/polychat-library-react";
import type { CreateProjectTaskInput, SourceActionItem } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

export function sourceActionItemTask(
  item: SourceActionItem,
  sourceTitle: string,
): CreateProjectTaskInput {
  const details = [item.owner && `owner: ${item.owner}`, item.due && `due ${item.due}`].filter(
    Boolean,
  );

  return {
    objective: details.length > 0 ? `${item.task} (${details.join(", ")})` : item.task,
    expectedOutput: `Done as agreed in "${sourceTitle}".`,
  };
}

export function useSourceActionItemTasks(projectId: string | null, sourceTitle: string) {
  const { create } = useProjectTasks(projectId ?? "");
  const [added, setAdded] = useState<ReadonlySet<number>>(() => new Set());
  const [adding, setAdding] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addActionItem = async (item: SourceActionItem, index: number) => {
    if (!projectId) {
      return;
    }

    setAdding(index);
    setError(null);

    try {
      await create.mutateAsync(sourceActionItemTask(item, sourceTitle));
      setAdded((current) => new Set(current).add(index));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The task could not be added.");
    } finally {
      setAdding(null);
    }
  };

  return { canAdd: Boolean(projectId), added, adding, error, addActionItem };
}
