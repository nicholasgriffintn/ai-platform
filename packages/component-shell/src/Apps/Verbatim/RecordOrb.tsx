import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Mic, Square } from "lucide-react";

export function RecordOrb({
  listening,
  starting,
  level,
  onToggle,
}: {
  listening: boolean;
  starting: boolean;
  level: number;
  onToggle: () => void;
}) {
  const ring = listening ? 1 + Math.min(1, level * 2.5) * 0.45 : 1;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={starting}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Start listening"}
      className="group relative grid size-20 shrink-0 place-items-center rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
    >
      <span
        className={cn(
          "absolute inset-0 rounded-full transition-transform duration-100 ease-out",
          listening ? "bg-accent-emerald/20" : "bg-transparent",
        )}
        style={{ transform: `scale(${ring})` }}
      />
      <span
        className={cn(
          "relative grid size-16 place-items-center rounded-full shadow-sm transition-colors duration-300",
          listening
            ? "bg-accent-emerald text-canvas"
            : "border border-border-strong bg-surface-elevated text-foreground group-hover:border-accent-emerald group-hover:text-accent-emerald",
        )}
      >
        {listening ? <Square size={18} fill="currentColor" /> : <Mic size={22} />}
      </span>
    </button>
  );
}
