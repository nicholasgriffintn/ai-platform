import { cn } from "@ngriffin_uk/polychat-component-ui";

import { WIND_DOWN_GRADIENT } from "./discover-art.js";
import type { WindDownPhase } from "./useWindDownPlayback.js";

const BREATH = `@keyframes discover-breath { 0%, 100% { transform: scale(0.82); opacity: 0.75; } 45% { transform: scale(1.08); opacity: 1; } }`;

export function DiscoverWindDownVisual({
  phase,
  text,
}: {
  phase: WindDownPhase;
  text: string | null;
}) {
  const breathing = phase !== "idle" && phase !== "finished";

  return (
    <>
      <style>{BREATH}</style>
      <div aria-hidden className="absolute inset-0" style={{ background: WIND_DOWN_GRADIENT }} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
        <span
          aria-hidden
          className="size-24 rounded-full bg-[radial-gradient(circle_at_35%_30%,#e0e7ff_0%,#818cf8_45%,#312e81_100%)] shadow-[0_0_80px_20px_rgba(129,140,248,0.35)] motion-reduce:animate-none sm:size-32"
          style={{ animation: breathing ? "discover-breath 10s ease-in-out infinite" : undefined }}
        />
        <p
          aria-live="polite"
          className={cn(
            "min-h-12 max-w-lg font-display text-base leading-relaxed text-balance text-white/90 transition-opacity duration-700 sm:text-lg",
            phase === "resting" && "opacity-40",
          )}
        >
          {text}
        </p>
      </div>
    </>
  );
}
