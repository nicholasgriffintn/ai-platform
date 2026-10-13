import { ModelIcon } from "@ngriffin_uk/polychat-component-models";
import type { BenchmarkMedal } from "@ngriffin_uk/polychat-schemas";

const MEDALS = [
  { key: "gold", label: "Gold", className: "bg-accent-amber" },
  { key: "silver", label: "Silver", className: "bg-accent-slate" },
  { key: "bronze", label: "Bronze", className: "bg-accent-orange" },
] as const;

const SHOWN = 8;

export function MedalTable({ medals }: { medals: readonly BenchmarkMedal[] }) {
  if (medals.length === 0) {
    return null;
  }

  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
      {medals.slice(0, SHOWN).map((medal, index) => (
        <li
          key={medal.entrant.kind === "model" ? medal.entrant.modelId : medal.entrant.name}
          className="flex items-center gap-3 px-4 py-2.5"
        >
          <span className="w-5 font-mono text-xs text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          {medal.entrant.kind === "model" ? (
            <ModelIcon modelName={medal.entrant.name} provider={medal.entrant.provider} size={16} />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
            {medal.entrant.name}
          </span>
          {MEDALS.map((kind) => (
            <span
              key={kind.key}
              className="flex w-9 items-center justify-end gap-1.5 text-sm text-foreground tabular-nums"
              title={`${kind.label} medals`}
            >
              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${kind.className}`} />
              {medal[kind.key]}
            </span>
          ))}
        </li>
      ))}
    </ol>
  );
}
