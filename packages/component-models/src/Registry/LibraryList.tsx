import { Button, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import type { LibraryEntry, SourceSearchResult } from "@ngriffin_uk/polychat-schemas";
import {
  formatBytes,
  formatCompactCount,
  formatParameterCount,
  shortenHash,
} from "@ngriffin_uk/polychat-utility-core";
import { Database, Download, Heart, Loader2 } from "lucide-react";

import { SignalChips, UsabilityBadge, VerdictBadge } from "./RegistryBadges";

const VERSION_STATUS_LABELS: Record<LibraryEntry["version"]["status"], string> = {
  importing: "Importing",
  inspecting: "Inspecting",
  ready: "Ready",
  failed: "Inspection failed",
};

export interface LibraryListProps {
  entries: readonly LibraryEntry[];
  onOpen: (entry: LibraryEntry) => void;
}

export function LibraryList({ entries, onOpen }: LibraryListProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Database size={28} />}
        title="Nothing on the perch yet"
        message="Search every source to import a model or dataset, pinned to the exact commit you review."
        className="min-h-[200px]"
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Licence</th>
            <th className="px-3 py-2 font-medium">Policy</th>
            <th className="px-3 py-2 font-medium">Standing</th>
            <th className="px-3 py-2 font-medium">Routes</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.version.id}
              className="cursor-pointer border-t border-border hover:bg-muted/40"
              onClick={() => onOpen(entry)}
            >
              <td className="px-3 py-2">
                <div className="font-medium text-foreground">{entry.asset.displayName}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {entry.asset.sourceRef} @ {shortenHash(entry.version.revision)}
                </div>
              </td>
              <td className="px-3 py-2 tabular-nums">
                {entry.version.attributes.parameterCount
                  ? formatParameterCount(entry.version.attributes.parameterCount)
                  : formatBytes(entry.version.attributes.totalBytes, 1)}
              </td>
              <td className="px-3 py-2">{entry.version.attributes.licence ?? "unknown"}</td>
              <td className="px-3 py-2">
                {entry.version.status === "ready" ? (
                  <VerdictBadge effect={entry.verdict.effect} />
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {entry.version.status !== "failed" && (
                      <Loader2 size={12} className="animate-spin" />
                    )}
                    {VERSION_STATUS_LABELS[entry.version.status]}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">
                <UsabilityBadge usable={entry.usable} state={entry.decision?.state ?? null} />
              </td>
              <td className="px-3 py-2 tabular-nums">{entry.routeCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface SourceResultsListProps {
  results: readonly SourceSearchResult[];
  importingRef: string | null;
  onImport: (result: SourceSearchResult) => void;
  onOpen: (versionId: string) => void;
}

export function SourceResultsList({
  results,
  importingRef,
  onImport,
  onOpen,
}: SourceResultsListProps) {
  if (results.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No matches on the Hub.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {results.map((result) => (
        <li key={result.sourceRef} className="flex flex-wrap items-center gap-3 px-3 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-foreground">{result.displayName}</span>
              <span className="font-mono text-xs text-muted-foreground">{result.sourceRef}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <SignalChips signals={result.signals} />
              <span className="inline-flex items-center gap-1">
                <Download size={12} /> {formatCompactCount(result.downloads)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart size={12} /> {formatCompactCount(result.likes)}
              </span>
              {result.pipelineTag && <span>{result.pipelineTag}</span>}
            </div>
            {result.preview.matches.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                Policy preview: {result.preview.matches.map((match) => match.ruleId).join(", ")}
              </p>
            )}
          </div>
          <VerdictBadge effect={result.preview.effect} />
          {result.library?.latestVersionId ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                result.library?.latestVersionId && onOpen(result.library.latestVersionId)
              }
            >
              Open
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              disabled={importingRef !== null}
              onClick={() => onImport(result)}
            >
              {importingRef === result.sourceRef ? "Importing…" : "Import"}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
