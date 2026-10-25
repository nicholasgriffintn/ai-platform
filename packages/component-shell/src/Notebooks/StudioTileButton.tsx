import { Pencil } from "lucide-react";

import type { StudioTile } from "./studio-kinds.js";

export function StudioTileButton({
  tile,
  disabled,
  onStart,
  onCustomise,
}: {
  tile: StudioTile;
  disabled: boolean;
  onStart: () => void;
  onCustomise: () => void;
}) {
  const Icon = tile.icon;

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={onStart}
        title={tile.description}
        className="flex h-full w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm leading-tight text-foreground transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50 @[17rem]:flex-row @[17rem]:items-center @[17rem]:gap-2"
      >
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1">{tile.label}</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCustomise}
        aria-label={`Customise ${tile.label.toLowerCase()}`}
        title="Customise"
        className="absolute top-1/2 right-1.5 -translate-y-1/2 cursor-pointer rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-selection hover:text-foreground focus-visible:opacity-100 disabled:hidden"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  );
}
