import type { DesktopExecutionLocation } from "@ngriffin_uk/polychat-schemas";

export interface ModelSourceEntry {
  id: string;
  label: string;
  detail?: string;
  disabled?: boolean;
}

export type ModelSourceReadiness = "ready" | "checking" | "unavailable" | "unknown";

export interface ModelSource {
  id: string;
  label: string;
  location: DesktopExecutionLocation;
  readiness: ModelSourceReadiness;
  hint?: string;
  entries: ModelSourceEntry[];
}

export interface ModelSourceSelection {
  sourceId: string;
  entryId: string;
  location: DesktopExecutionLocation;
}

export interface ModelSourcePickerProps {
  sources: ModelSource[];
  selected: ModelSourceSelection | null;
  onSelect: (selection: ModelSourceSelection) => void;
}

const READINESS_LABELS: Record<ModelSourceReadiness, string> = {
  ready: "Ready",
  checking: "Checking",
  unavailable: "Not running",
  unknown: "Not checked",
};

export function describeSource(source: ModelSource): string {
  if (source.readiness !== "ready") {
    return source.hint ?? READINESS_LABELS[source.readiness];
  }

  if (source.entries.length === 0) {
    return "No models installed here";
  }

  return `${source.entries.length} available`;
}

export function ModelSourcePicker({ sources, selected, onSelect }: ModelSourcePickerProps) {
  return (
    <div className="flex flex-col gap-3">
      {sources.map((source) => (
        <section key={source.id} className="flex flex-col gap-1">
          <header className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">{source.label}</h3>
            <span className="text-xs text-muted-foreground">{describeSource(source)}</span>
          </header>
          {source.entries.length === 0 ? null : (
            <ul className="flex flex-col">
              {source.entries.map((entry) => {
                const isSelected =
                  selected?.sourceId === source.id && selected.entryId === entry.id;

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      disabled={entry.disabled || source.readiness !== "ready"}
                      aria-pressed={isSelected}
                      onClick={() =>
                        onSelect({
                          sourceId: source.id,
                          entryId: entry.id,
                          location: source.location,
                        })
                      }
                      className="flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-sm disabled:opacity-50"
                    >
                      <span>{entry.label}</span>
                      {entry.detail ? (
                        <span className="text-xs text-muted-foreground">{entry.detail}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
