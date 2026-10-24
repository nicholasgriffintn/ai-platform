import type { SourceSummary } from "@ngriffin_uk/polychat-schemas";
import { toggleSetMember } from "@ngriffin_uk/polychat-utility-core";
import { useState } from "react";

export function useNotebookSourceSelection(sources: readonly SourceSummary[]) {
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(() => new Set());
  const selectable = sources.filter((source) => source.status === "available");
  const selectedIds = selectable
    .filter((source) => !deselected.has(source.id))
    .map((source) => source.id);

  return {
    selectedIds,
    isAllSelected: selectedIds.length === selectable.length && selectable.length > 0,
    isSelected: (sourceId: string) => !deselected.has(sourceId),
    toggle: (sourceId: string) => setDeselected((current) => toggleSetMember(current, sourceId)),
    setAll: (selected: boolean) =>
      setDeselected(selected ? new Set() : new Set(selectable.map((source) => source.id))),
  };
}

export type NotebookSourceSelection = ReturnType<typeof useNotebookSourceSelection>;
