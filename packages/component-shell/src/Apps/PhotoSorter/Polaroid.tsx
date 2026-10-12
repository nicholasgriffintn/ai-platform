import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent, hashSeed } from "@ngriffin_uk/polychat-utility-core";
import { Droplets, Monitor, ScanFace, Type } from "lucide-react";
import type { ReactNode } from "react";

import type { PhotoFlag } from "./piles.js";
import type { PhotoItem } from "./usePhotoSorter.js";

const FLAG_ICONS: Record<PhotoFlag, { icon: typeof Type; label: string }> = {
  face: { icon: ScanFace, label: "Face" },
  text: { icon: Type, label: "Text" },
  blurry: { icon: Droplets, label: "Blurry" },
  screenshot: { icon: Monitor, label: "Screenshot" },
};

export function Polaroid({ item, children }: { item: PhotoItem; children?: ReactNode }) {
  const tilt = (hashSeed(item.id) % 7) - 3;
  const developing = item.state === "queued" || item.state === "sorting";

  return (
    <figure
      className="group w-full rounded-[3px] bg-card p-1.5 pb-2 shadow-[0_10px_24px_-14px_rgb(0_0_0/0.55)] ring-1 ring-border transition-transform duration-300 ease-out hover:z-10 hover:scale-[1.04] hover:rotate-0 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in-0 motion-safe:zoom-in-95"
      style={{ rotate: `${tilt}deg` }}
    >
      <div className="relative aspect-square overflow-hidden bg-surface-elevated">
        <img
          src={item.previewUrl}
          alt={item.name}
          className={cn(
            "h-full w-full object-cover transition-[filter,opacity] duration-700",
            developing && "opacity-70 blur-[3px] grayscale sepia",
          )}
        />
        {item.state === "sorting" && <span className="polychat-motion-sheen" />}
        {item.state === "sorted" && item.result.flags.length > 0 && (
          <div className="absolute top-1 right-1 flex gap-0.5">
            {item.result.flags.map((flag) => {
              const { icon: Icon, label } = FLAG_ICONS[flag];

              return (
                <span
                  key={flag}
                  title={label}
                  className="grid size-5 place-items-center rounded-full bg-black/55 text-white"
                >
                  <Icon size={11} />
                </span>
              );
            })}
          </div>
        )}
      </div>
      <figcaption className="flex min-h-6 items-center justify-between gap-1 px-0.5 pt-1.5 font-mono text-[10px] text-muted-foreground">
        {developing && <span className="polychat-motion-shimmer">developing…</span>}
        {item.state === "failed" && (
          <span className="truncate text-failure" title={item.error}>
            spoiled
          </span>
        )}
        {item.state === "sorted" && (
          <>
            <span className="tabular-nums">{formatProbabilityPercent(item.result.confidence)}</span>
            <span className="truncate">
              {item.manualPileId ? "filed by you" : item.result.keeper}
            </span>
          </>
        )}
      </figcaption>
      {children}
    </figure>
  );
}
