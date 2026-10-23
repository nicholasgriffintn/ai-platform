import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export interface InstalledCapabilityTile {
  id: string;
  label: string;
  icon: ReactNode;
  onSelect?: () => void;
}

const VISIBLE_TILES = 12;

export function InstalledCapabilities({
  tiles,
  onShowAll,
}: {
  tiles: readonly InstalledCapabilityTile[];
  onShowAll: () => void;
}) {
  const visible = tiles.slice(0, VISIBLE_TILES);
  const hidden = tiles.length - visible.length;

  return (
    <section aria-labelledby="installed-capabilities" className="mb-10">
      <h2 id="installed-capabilities" className="mb-3 text-lg font-semibold text-foreground">
        <button
          type="button"
          onClick={onShowAll}
          className="inline-flex items-center gap-1 rounded-md hover:text-muted-foreground"
        >
          Installed
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </h2>
      <ul className="flex flex-wrap gap-2 border-t border-border pt-4">
        {visible.map((tile) => (
          <li key={tile.id}>
            {tile.onSelect ? (
              <button
                type="button"
                title={tile.label}
                aria-label={tile.label}
                onClick={tile.onSelect}
                className="block rounded-xl transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {tile.icon}
              </button>
            ) : (
              <span title={tile.label} className="block">
                {tile.icon}
                <span className="sr-only">{tile.label}</span>
              </span>
            )}
          </li>
        ))}
        {hidden > 0 ? (
          <li>
            <button
              type="button"
              onClick={onShowAll}
              aria-label={`Show all ${tiles.length} installed`}
              className="flex size-12 items-center justify-center rounded-xl border border-border bg-surface text-xs font-medium text-muted-foreground hover:bg-surface-elevated"
            >
              +{hidden}
            </button>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
