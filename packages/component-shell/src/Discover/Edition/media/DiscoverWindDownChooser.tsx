import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import {
  DISCOVER_WIND_DOWN_KINDS,
  DISCOVER_WIND_DOWN_MINUTES,
  type CreateDiscoverWindDown,
  type DiscoverWindDownKind,
} from "@ngriffin_uk/polychat-schemas";
import { Play } from "lucide-react";
import { useState, type ReactNode } from "react";

const KINDS: Record<DiscoverWindDownKind, { label: string; detail: string }> = {
  breathing: { label: "Breathing", detail: "Slow, counted breaths" },
  body_scan: { label: "Body scan", detail: "Attention moves from head to toe" },
  unwind: { label: "Unwind", detail: "Set the day down, one thing at a time" },
};

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{label}</legend>
      {children}
    </fieldset>
  );
}

export function DiscoverWindDownChooser({
  initial,
  isStarting,
  onBegin,
  onCancel,
}: {
  initial: CreateDiscoverWindDown | null;
  isStarting: boolean;
  onBegin: (input: CreateDiscoverWindDown) => void;
  onCancel?: () => void;
}) {
  const [kind, setKind] = useState<DiscoverWindDownKind>(initial?.kind ?? "breathing");
  const [minutes, setMinutes] = useState<CreateDiscoverWindDown["minutes"]>(initial?.minutes ?? 10);

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <OptionGroup label="What kind">
        <div className="grid gap-2 sm:grid-cols-3">
          {DISCOVER_WIND_DOWN_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                kind === option
                  ? "border-foreground bg-selection"
                  : "border-border hover:bg-selection",
              )}
            >
              <span className="text-sm font-medium text-foreground">{KINDS[option].label}</span>
              <span className="text-xs text-muted-foreground">{KINDS[option].detail}</span>
            </button>
          ))}
        </div>
      </OptionGroup>
      <OptionGroup label="How long">
        <div className="inline-flex w-fit rounded-full border border-border p-0.5">
          {DISCOVER_WIND_DOWN_MINUTES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={minutes === option}
              onClick={() => setMinutes(option)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm tabular-nums transition-colors",
                minutes === option
                  ? "bg-foreground text-canvas"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option} min
            </button>
          ))}
        </div>
      </OptionGroup>
      <div className="flex items-center gap-2">
        <Button variant="primary" disabled={isStarting} onClick={() => onBegin({ kind, minutes })}>
          <Play size={15} aria-hidden />
          Begin {KINDS[kind].label.toLowerCase()}, {minutes} min
        </Button>
        {onCancel ? (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </section>
  );
}
