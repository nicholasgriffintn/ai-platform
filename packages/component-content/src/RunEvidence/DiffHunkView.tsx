import { cn } from "@ngriffin_uk/polychat-component-ui";

import { groupDiffHunkLines, type DiffHunk } from "./parseUnifiedDiff";

const LINE_TONE = {
  added: "bg-success/10 text-foreground",
  removed: "bg-failure/10 text-foreground",
  context: "text-muted-foreground",
  meta: "text-muted-foreground italic",
} as const;

const MARKER_TONE = {
  added: "text-success",
  removed: "text-failure",
  context: "text-muted-foreground/60",
  meta: "text-muted-foreground/60",
} as const;

const MARKERS = { added: "+", removed: "−", context: " ", meta: " " } as const;

type DiffLineKind = keyof typeof LINE_TONE;

function lineKind(line: string): DiffLineKind {
  if (line.startsWith("+")) {
    return "added";
  }

  if (line.startsWith("-")) {
    return "removed";
  }

  return line.startsWith("\\") ? "meta" : "context";
}

function DiffLines({ lines }: { lines: string[] }) {
  return lines.map((line, index) => {
    const kind = lineKind(line);

    return (
      <div
        key={`${index}-${line}`}
        className={cn("flex gap-2 px-3 font-mono text-xs leading-5", LINE_TONE[kind])}
      >
        <span
          aria-hidden="true"
          className={cn("w-2 shrink-0 whitespace-pre select-none", MARKER_TONE[kind])}
        >
          {MARKERS[kind]}
        </span>
        <span className="whitespace-pre">{kind === "meta" ? line : line.slice(1)}</span>
      </div>
    );
  });
}

export function DiffHunkView({ hunk }: { hunk: DiffHunk }) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-canvas">
      <h4 className="bg-surface-elevated px-3 py-2 font-mono text-xs text-muted-foreground">
        {hunk.header}
      </h4>
      <div className="overflow-x-auto">
        <div className="w-max min-w-full py-1">
          {groupDiffHunkLines(hunk.lines).map((group) =>
            group.kind === "context" ? (
              <details key={`context-${group.startIndex}`} open>
                <summary className="cursor-pointer px-3 py-1 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                  {group.lines.length} unchanged {group.lines.length === 1 ? "line" : "lines"}
                </summary>
                <DiffLines lines={group.lines} />
              </details>
            ) : (
              <DiffLines key={`change-${group.startIndex}`} lines={group.lines} />
            ),
          )}
        </div>
      </div>
    </section>
  );
}
