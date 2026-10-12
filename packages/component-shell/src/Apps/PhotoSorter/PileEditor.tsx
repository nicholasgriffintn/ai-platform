import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Plus, X } from "lucide-react";

import { MAX_PILES, MIN_PILES, PILE_PRESETS, type Pile, type PilePreset } from "./piles.js";

export function PileEditor({
  piles,
  onRename,
  onRemove,
  onAdd,
  onPreset,
}: {
  piles: readonly Pile[];
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  onPreset: (preset: PilePreset) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tracking-[0.08em] uppercase">Piles</span>
        {PILE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="underline-offset-4 hover:text-foreground hover:underline"
            onClick={() => onPreset(preset)}
          >
            {preset.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {piles.map((pile) => (
          <span
            key={pile.id}
            className="group flex items-center rounded-full border border-border bg-card py-1 pr-1 pl-3 transition-colors focus-within:border-accent-amber"
          >
            <input
              value={pile.label}
              aria-label="Pile name"
              maxLength={60}
              size={Math.max(4, pile.label.length)}
              onChange={(event) => onRename(pile.id, event.target.value)}
              className="bg-transparent text-sm outline-none"
            />
            <button
              type="button"
              aria-label={`Remove ${pile.label}`}
              disabled={piles.length <= MIN_PILES}
              onClick={() => onRemove(pile.id)}
              className="grid size-5 place-items-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-foreground focus-visible:opacity-100 disabled:hidden"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={onAdd}
          disabled={piles.length >= MAX_PILES}
          className={cn(
            "flex items-center gap-1 rounded-full border border-dashed border-border-strong px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-accent-amber hover:text-foreground disabled:opacity-40",
          )}
        >
          <Plus size={14} /> Pile
        </button>
      </div>
    </div>
  );
}
