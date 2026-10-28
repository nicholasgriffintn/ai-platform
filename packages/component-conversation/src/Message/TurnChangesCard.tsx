import { RunChangesView } from "@ngriffin_uk/polychat-component-content";
import type { AgentTurnChanges } from "@ngriffin_uk/polychat-schemas";
import { ChevronDown, ChevronRight, FileDiff } from "lucide-react";
import { useState } from "react";

function sum(values: Array<number | null>): number {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

export function TurnChangesCard({ changes }: { changes: AgentTurnChanges }) {
  const [open, setOpen] = useState(false);
  const additions = sum(changes.files.map((file) => file.additions));
  const deletions = sum(changes.files.map((file) => file.deletions));
  const fileCount = changes.files.length;

  return (
    <div className="rounded-lg border border-border bg-surface-elevated">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
      >
        <FileDiff size={16} aria-hidden="true" />
        <span className="flex-1">
          Changed {fileCount} {fileCount === 1 ? "file" : "files"}
        </span>
        <span className="font-mono text-xs text-success">+{additions}</span>
        <span className="font-mono text-xs text-failure">-{deletions}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open ? (
        <div className="border-t border-border p-2">
          <RunChangesView
            content={{
              text: changes.patch,
              contentType: "text/x-diff; charset=utf-8",
              truncated: changes.truncated,
              binary: false,
            }}
            recordedFiles={changes.files.map((file) => file.path)}
          />
        </div>
      ) : null}
    </div>
  );
}
