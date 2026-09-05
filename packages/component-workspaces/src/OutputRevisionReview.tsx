import { Badge, Button } from "@ngriffin_uk/polychat-component-ui";
import type { OutputHistoryResponse } from "@ngriffin_uk/polychat-schemas";
import { History, RotateCcw } from "lucide-react";
import { useState } from "react";

import { changedOutputRevisionFields, formatOutputRevisionContent } from "./output-revisions";
import { OutputProvenanceSummary } from "./OutputProvenanceSummary";

export interface OutputRevisionReviewProps {
  history: OutputHistoryResponse;
  isRestoring?: boolean;
  errorMessage?: string;
  onRestore: (revision: number, expectedRevision: number) => void | Promise<void>;
}

export function OutputRevisionReview({
  history,
  isRestoring = false,
  errorMessage,
  onRestore,
}: OutputRevisionReviewProps) {
  const [selectedRevision, setSelectedRevision] = useState<number | null>(
    history.revisions[0]?.revision ?? null,
  );
  const selected =
    history.revisions.find((revision) => revision.revision === selectedRevision) ??
    history.revisions[0] ??
    null;

  if (!selected) {
    return (
      <section aria-label="Revision history" className="rounded-lg border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <History size={16} aria-hidden /> Revision history
        </p>
        <p className="mt-1 text-sm text-zinc-500">No earlier revisions yet.</p>
      </section>
    );
  }

  const changedFields = changedOutputRevisionFields(history.current, selected);

  return (
    <section aria-label="Revision history" className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium">
            <History size={16} aria-hidden /> Revision history
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Current revision {history.current.revision} · {history.current.operation}
            {history.current.restoredFromRevision
              ? ` from revision ${history.current.restoredFromRevision}`
              : ""}
          </p>
        </div>
        <label className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Compare with
          <select
            className="ml-2 rounded-md border bg-transparent px-2 py-1"
            value={selected.revision}
            onChange={(event) => setSelectedRevision(Number(event.target.value))}
          >
            {history.revisions.map((revision) => (
              <option key={revision.revision} value={revision.revision}>
                Revision {revision.revision} · {revision.operation}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Changed fields">
        {changedFields.length > 0 ? (
          changedFields.map((field) => <Badge key={field}>{field} changed</Badge>)
        ) : (
          <Badge variant="outline">No content changes</Badge>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <RevisionColumn
          label={`Revision ${selected.revision}`}
          title={selected.title}
          content={formatOutputRevisionContent(selected.content)}
        />
        <RevisionColumn
          label={`Current · revision ${history.current.revision}`}
          title={history.current.title}
          content={formatOutputRevisionContent(history.current.content)}
        />
      </div>

      <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Origin of revision {selected.revision}
        </p>
        <OutputProvenanceSummary provenance={selected.provenance} />
      </div>

      <div>
        <Button
          variant="outline"
          disabled={!history.restore.supported || isRestoring}
          onClick={() => void onRestore(selected.revision, history.current.revision)}
        >
          <RotateCcw size={15} aria-hidden />
          {isRestoring ? "Restoring…" : `Restore revision ${selected.revision}`}
        </Button>
        <p className="mt-1.5 text-xs text-zinc-500">
          {history.restore.supported
            ? "Restore appends a new local revision. It does not undo external actions."
            : history.restore.reason}
        </p>
        {errorMessage && (
          <p role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-400">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function RevisionColumn({
  label,
  title,
  content,
}: {
  label: string;
  title: string;
  content: string;
}) {
  return (
    <article className="min-w-0 rounded-md border bg-white p-3 dark:bg-zinc-950">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium">{title}</p>
      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
        {content}
      </pre>
    </article>
  );
}
