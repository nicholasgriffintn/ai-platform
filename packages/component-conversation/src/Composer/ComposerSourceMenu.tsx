import type { SourceSummary } from "@ngriffin_uk/polychat-schemas";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";

export function ComposerSourceMenu({
  attachingSourceId,
  isLoading,
  onBack,
  onSelect,
  scopeLabel,
  sources,
}: {
  attachingSourceId?: string | null;
  isLoading?: boolean;
  onBack: () => void;
  onSelect: (sourceId: string) => void;
  scopeLabel: string;
  sources: SourceSummary[];
}) {
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-zinc-200 px-1 pb-2 dark:border-zinc-700">
        <button
          type="button"
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Back to composer actions"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Attach source</p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{scopeLabel}</p>
        </div>
      </div>

      <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading sources…
          </div>
        ) : sources.length ? (
          sources.map((source) => (
            <button
              key={source.id}
              type="button"
              disabled={Boolean(attachingSourceId)}
              onClick={() => onSelect(source.id)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-wait disabled:opacity-60 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center"
                aria-hidden="true"
              >
                {attachingSourceId === source.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{source.title}</span>
                <span className="block text-xs capitalize text-zinc-500 dark:text-zinc-400">
                  {source.kind}
                </span>
              </span>
            </button>
          ))
        ) : (
          <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
            No available sources.
          </p>
        )}
      </div>
    </div>
  );
}
