import { MemoizedMarkdown } from "@ngriffin_uk/polychat-component-content";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useSourceEditing, useSourceRevisions } from "@ngriffin_uk/polychat-library-react";
import type { Source, SourceRevision } from "@ngriffin_uk/polychat-schemas";
import { formatRelativeTime, getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

function describeRevision(revision: SourceRevision): string {
  switch (revision.operation) {
    case "created":
      return "First version";
    case "restored":
      return "Brought back from an earlier version";
    case "updated":
      return "Edited";
  }
}

export function SourceHistory({ source, canRestore }: { source: Source; canRestore: boolean }) {
  const revisions = useSourceRevisions(source.id);
  const { restore } = useSourceEditing(source.id);

  if (revisions.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading earlier versions…</p>;
  }

  if (revisions.error) {
    return (
      <p role="alert" className="text-sm text-failure">
        Earlier versions are unavailable.
      </p>
    );
  }

  const entries = revisions.data ?? [];

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No earlier versions yet. Each editing session keeps one.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {entries.map((revision) => {
        const isCurrent = revision.revision === source.revision;

        return (
          <li key={revision.id}>
            <details className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-foreground">
                  {describeRevision(revision)}
                  {isCurrent ? <span className="text-muted-foreground"> · Current</span> : null}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRelativeTime(revision.createdAt)}
                </span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground">{revision.title}</p>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <MemoizedMarkdown>{revision.content || "_Empty_"}</MemoizedMarkdown>
                </div>
                {canRestore && !isCurrent ? (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<RotateCcw size={14} />}
                      isLoading={
                        restore.isPending && restore.variables?.revision === revision.revision
                      }
                      disabled={restore.isPending}
                      onClick={() =>
                        restore.mutate(
                          { revision: revision.revision, expectedRevision: source.revision },
                          {
                            onSuccess: () => toast.success("That version is back"),
                            onError: (error) =>
                              toast.error(getErrorMessage(error, "That version didn't come back")),
                          },
                        )
                      }
                    >
                      Bring this version back
                    </Button>
                  </div>
                ) : null}
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
