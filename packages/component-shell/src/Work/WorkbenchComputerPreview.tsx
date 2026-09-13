import { ComputerObservationView } from "@ngriffin_uk/polychat-component-conversation";
import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ComputerObservation } from "@ngriffin_uk/polychat-library-chat/tool-results";
import { MonitorPlay } from "lucide-react";
import { useState } from "react";

export function WorkbenchComputerPreview({
  observations,
}: {
  observations: ComputerObservation[];
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected =
    observations.find((observation) => observation.id === selectedId) ??
    observations[observations.length - 1];

  if (!selected) {
    return null;
  }

  return (
    <section aria-label="Hosted computer" className="flex min-h-full flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <MonitorPlay className="size-4 shrink-0 text-creative" aria-hidden="true" />
        <h2 className="truncate text-sm font-medium text-foreground">Hosted computer</h2>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {observations.length} {observations.length === 1 ? "capture" : "captures"}
        </span>
      </div>
      <ComputerObservationView
        key={selected.id}
        data={{
          screenshot: selected.screenshot,
          title: selected.title,
          width: selected.width,
          height: selected.height,
        }}
      />
      {observations.length > 1 ? (
        <ul className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Earlier captures">
          {observations.map((observation) => (
            <li key={observation.id} className="shrink-0">
              <button
                type="button"
                title={observation.title}
                aria-label={`Show capture: ${observation.title}`}
                aria-pressed={observation.id === selected.id}
                onClick={() => setSelectedId(observation.id)}
                className={cn(
                  "block h-12 w-20 overflow-hidden rounded border bg-surface-elevated",
                  observation.id === selected.id
                    ? "border-active-work"
                    : "border-border opacity-70 hover:opacity-100",
                )}
              >
                {observation.screenshot ? (
                  <img
                    src={observation.screenshot}
                    alt=""
                    className="size-full object-cover"
                    decoding="async"
                  />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
