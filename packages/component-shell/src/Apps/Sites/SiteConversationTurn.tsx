import type { SiteElementTarget, SiteProject, SiteTraceEntry } from "@ngriffin_uk/polychat-schemas";
import { MousePointerSquareDashed } from "lucide-react";

import { SiteTraceEntries } from "./SiteTraceEntries.js";

export interface SiteConversationTurnProps {
  prompt: string;
  project: SiteProject | null;
  target?: SiteElementTarget | null;
  entries: SiteTraceEntry[];
}

export function SiteConversationTurn({
  prompt,
  project,
  target,
  entries,
}: SiteConversationTurnProps) {
  const element = target ? project?.pages[target.pageId]?.elements[target.elementKey] : null;

  return (
    <section className="flex flex-col gap-2">
      <div className="ml-6 rounded-lg bg-accent px-3 py-2 text-accent-foreground">
        {target && (
          <div className="mb-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-muted-foreground">
            <MousePointerSquareDashed size={11} className="shrink-0" />
            <span className="font-medium text-accent-foreground">
              Selected {element?.type ?? "element"}
            </span>
            <span className="truncate font-mono">
              {target.pageId}/{target.elementKey}
            </span>
          </div>
        )}
        <p className="text-sm">{prompt}</p>
      </div>
      <SiteTraceEntries entries={entries} />
    </section>
  );
}
