import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { SiteTraceEntry } from "@ngriffin_uk/polychat-schemas";
import { Code2, Wrench } from "lucide-react";

import { SiteDecisionCard } from "./SiteDecisionCard.js";

function GenerationCard({ entry }: { entry: Extract<SiteTraceEntry, { kind: "generation" }> }) {
  const Icon = entry.stage === "repair" ? Wrench : Code2;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3 shadow-xs">
      <div className="flex items-start gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Icon size={14} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
              {entry.stage === "repair" ? "Automatic repair" : "Site build"}
            </span>
            {entry.outcome === "discarded" && <Badge variant="outline">Discarded</Badge>}
          </div>
          <p className="mt-1 text-sm font-medium text-foreground">{entry.summary}</p>
          <p className="mt-1.5 truncate font-mono text-[10px] text-muted-foreground">
            {entry.provider} · {entry.model} · {entry.durationMs}ms
          </p>
        </div>
      </div>
    </div>
  );
}

export function SiteTraceEntries({ entries }: { entries: SiteTraceEntry[] }) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) =>
        entry.kind === "decision" ? (
          <SiteDecisionCard key={entry.id} entry={entry} />
        ) : (
          <GenerationCard key={entry.id} entry={entry} />
        ),
      )}
    </div>
  );
}
