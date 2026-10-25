import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useKnowledgeSyncs } from "@ngriffin_uk/polychat-library-react";
import { ChevronRight, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { KnowledgeSyncList } from "../Files/Library/KnowledgeSyncList.js";

export function NotebookSyncsRow({ notebookId }: { notebookId: string }) {
  const target = { notebookId };
  const { data: syncs = [] } = useKnowledgeSyncs(target);
  const [isOpen, setIsOpen] = useState(false);
  const hasError = syncs.some((sync) => sync.lastError);

  if (syncs.length === 0) {
    return null;
  }

  return (
    <li className="flex flex-col">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-selection hover:text-foreground"
      >
        {hasError ? (
          <TriangleAlert className="size-4 shrink-0 text-failure" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate">Followed ({syncs.length})</span>
        <ChevronRight
          className={cn("size-4 shrink-0 transition-transform", isOpen && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div className="ml-6 border-l border-border pl-2">
          <KnowledgeSyncList target={target} syncs={syncs} />
        </div>
      ) : null}
    </li>
  );
}
