import type { TopicSwatch } from "./tracker-colours.js";

export function TopicLegend({ swatches }: { swatches: readonly TopicSwatch[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {swatches.map((swatch) => (
        <li key={swatch.key} className="inline-flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-sm"
            style={{ backgroundColor: swatch.colour }}
          />
          <span className="truncate">{swatch.label}</span>
        </li>
      ))}
    </ul>
  );
}
