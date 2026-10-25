import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { DiscoverWindDownBed, DiscoverWindDownKind } from "@ngriffin_uk/polychat-schemas";

import type { WindDownPhase } from "./useWindDownPlayback.js";
import { WindDownScene } from "./WindDownScene.js";

const BREATH = `@keyframes discover-breath { 0%, 100% { transform: scale(0.82); opacity: 0.75; } 45% { transform: scale(1.08); opacity: 1; } }`;

export function DiscoverWindDownVisual({
  phase,
  text,
  bed,
  kind,
  seed,
}: {
  phase: WindDownPhase;
  text: string | null;
  bed: DiscoverWindDownBed;
  kind: DiscoverWindDownKind | null;
  seed: string;
}) {
  const playing = phase !== "idle" && phase !== "finished";

  return (
    <>
      <style>{BREATH}</style>
      <WindDownScene bed={bed} seed={seed} moving={playing} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/20 px-8 pt-16 pb-4 text-center">
        {kind === "breathing" ? (
          <span
            aria-hidden
            className="size-20 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e0e7ff_0%,#818cf8_45%,#312e81_100%)] shadow-[0_0_80px_20px_rgba(129,140,248,0.35)] motion-reduce:animate-none sm:size-28"
            style={{ animation: playing ? "discover-breath 10s ease-in-out infinite" : undefined }}
          />
        ) : null}
        <p
          aria-live="polite"
          className={cn(
            "min-h-12 max-w-lg font-display text-base leading-relaxed text-balance text-white/90 drop-shadow transition-opacity duration-700 sm:text-lg",
            phase === "resting" && "opacity-40",
          )}
        >
          {text}
        </p>
      </div>
    </>
  );
}
