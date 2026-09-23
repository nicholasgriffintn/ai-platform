import { Badge, Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { useOutputHistory, useRestoreOutputRevision } from "@ngriffin_uk/polychat-library-react";
import {
  siteProjectSchema,
  siteTurnSchema,
  type OutputRevision,
  type SiteProject,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { History, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

export interface SiteRevisionPreview {
  revision: number;
  project: SiteProject;
}

export interface SiteHistoryProps {
  siteId: string;
  currentRevision: number;
  previewRevision: number | null;
  onPreview: (preview: SiteRevisionPreview | null) => void;
  onRestored: () => void;
  onClose: () => void;
}

function describeRevision(revision: OutputRevision): string {
  const turns =
    isRecord(revision.content) && Array.isArray(revision.content.turns)
      ? revision.content.turns
      : [];
  const last = turns.at(-1);
  const turn = siteTurnSchema.safeParse(last);

  if (turn.success) {
    return turn.data.prompt;
  }

  return revision.operation === "restored" && revision.restoredFromRevision
    ? `Restored revision ${revision.restoredFromRevision}`
    : revision.operation;
}

function readProject(revision: OutputRevision): SiteProject | null {
  const parsed = siteProjectSchema.safeParse(
    isRecord(revision.content) ? revision.content.project : null,
  );

  return parsed.success ? parsed.data : null;
}

export function SiteHistory({
  siteId,
  currentRevision,
  previewRevision,
  onPreview,
  onRestored,
  onClose,
}: SiteHistoryProps) {
  const { data, isLoading } = useOutputHistory(siteId);
  const restore = useRestoreOutputRevision();
  const revisions = data ? [data.current, ...data.revisions] : [];
  const seen = new Set<number>();
  const ordered = revisions
    .filter((revision) => {
      if (seen.has(revision.revision)) {
        return false;
      }

      seen.add(revision.revision);

      return true;
    })
    .sort((a, b) => b.revision - a.revision);

  const handleRestore = async (revision: number) => {
    try {
      await restore.mutateAsync({ outputId: siteId, revision, expectedRevision: currentRevision });
      toast.success(`Restored revision ${revision}`);
      onPreview(null);
      onRestored();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The revision could not be restored");
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-80 flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <History size={14} /> History
        </span>
        <Button
          variant="icon"
          size="icon"
          aria-label="Close history"
          icon={<X size={14} />}
          onClick={onClose}
        />
      </div>
      <ul className="min-h-0 flex-1 overflow-auto py-1">
        {isLoading && (
          <li className="px-3 py-2 text-xs text-muted-foreground">Loading revisions</li>
        )}
        {ordered.map((revision) => {
          const isCurrent = revision.revision === currentRevision;
          const isPreviewing = revision.revision === previewRevision;
          const project = readProject(revision);

          return (
            <li key={revision.revision}>
              <button
                type="button"
                disabled={!project}
                onClick={() =>
                  project && !isCurrent
                    ? onPreview(isPreviewing ? null : { revision: revision.revision, project })
                    : onPreview(null)
                }
                className={cn(
                  "flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-accent/60",
                  isPreviewing && "bg-accent",
                )}
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">Revision {revision.revision}</span>
                  <span className="flex items-center gap-1">
                    {isCurrent && <Badge variant="secondary">current</Badge>}
                    <span className="text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString()}
                    </span>
                  </span>
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {describeRevision(revision)}
                </span>
              </button>
              {isPreviewing && data?.restore.supported && (
                <div className="px-3 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<RotateCcw size={14} />}
                    onClick={() => void handleRestore(revision.revision)}
                    isLoading={restore.isPending}
                  >
                    Restore this revision
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
