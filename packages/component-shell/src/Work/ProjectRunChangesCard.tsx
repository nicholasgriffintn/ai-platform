import {
  orderDiffFilesForReview,
  parseUnifiedDiff,
  type RunEvidenceContent,
} from "@ngriffin_uk/polychat-component-content";
import { Button, WorkbenchCard } from "@ngriffin_uk/polychat-component-ui";
import { FileDiff } from "lucide-react";
import { useMemo } from "react";

const VISIBLE_FILES = 6;

export function ProjectRunChangesCard({
  diffContent,
  recordedFiles,
  onOpenChanges,
}: {
  diffContent?: RunEvidenceContent;
  recordedFiles: readonly string[];
  onOpenChanges: () => void;
}) {
  const diffText = diffContent?.text;
  const files = useMemo(
    () => (diffText ? orderDiffFilesForReview(parseUnifiedDiff(diffText)) : []),
    [diffText],
  );

  if (files.length === 0 && recordedFiles.length === 0) {
    return null;
  }

  const additions = files.reduce((sum, file) => sum + file.additions, 0);
  const deletions = files.reduce((sum, file) => sum + file.deletions, 0);
  const rows =
    files.length > 0
      ? files.map((file) => ({
          path: file.path,
          additions: file.additions,
          deletions: file.deletions,
        }))
      : recordedFiles.map((path) => ({ path, additions: undefined, deletions: undefined }));

  return (
    <WorkbenchCard
      title="Changes"
      icon={FileDiff}
      aside={
        files.length > 0 ? (
          <span className="font-mono text-[11px] tabular-nums">
            <span className="text-success">+{additions.toLocaleString()}</span>{" "}
            <span className="text-failure">−{deletions.toLocaleString()}</span>
          </span>
        ) : (
          <span className="font-mono text-[11px] tabular-nums">
            {recordedFiles.length} {recordedFiles.length === 1 ? "file" : "files"}
          </span>
        )
      }
    >
      <ul className="space-y-0.5">
        {rows.slice(0, VISIBLE_FILES).map((row) => (
          <li key={row.path} className="flex min-h-6 items-center gap-2">
            <span
              className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground"
              title={row.path}
            >
              {row.path}
            </span>
            {row.additions !== undefined ? (
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                <span className="text-success">+{row.additions}</span>{" "}
                <span className="text-failure">−{row.deletions}</span>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length > VISIBLE_FILES ? (
        <p className="mt-1">and {(rows.length - VISIBLE_FILES).toLocaleString()} more</p>
      ) : null}
      <Button type="button" variant="secondary" size="xs" className="mt-2" onClick={onOpenChanges}>
        Review changes
      </Button>
    </WorkbenchCard>
  );
}
