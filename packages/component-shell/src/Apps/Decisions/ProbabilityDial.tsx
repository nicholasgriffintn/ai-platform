import { cn } from "@ngriffin_uk/polychat-component-ui";
import { formatProbabilityPercent } from "@ngriffin_uk/polychat-utility-core";

import { PROBABILITY_TEXT_CLASS, probabilityTone } from "./probability.js";

const TICKS = Array.from({ length: 11 }, (_, index) => index / 10);

function polar(fraction: number, radius: number) {
  const angle = Math.PI * (1 - fraction);

  return { x: 50 + radius * Math.cos(angle), y: 50 - radius * Math.sin(angle) };
}

export function ProbabilityDial({
  probability,
  label,
  size = "md",
}: {
  probability: number | null;
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  const value = probability ?? 0.5;
  const start = polar(0, 40);
  const end = polar(1, 40);
  const filled = polar(value, 40);
  const tone = probability === null ? null : probabilityTone(value);

  return (
    <figure className="flex flex-col items-center">
      <svg
        viewBox="0 0 100 58"
        className={cn(size === "lg" ? "w-72" : size === "md" ? "w-40" : "w-24")}
        aria-hidden
      >
        <path
          d={`M ${start.x} ${start.y} A 40 40 0 0 1 ${end.x} ${end.y}`}
          fill="none"
          className="stroke-border"
          strokeWidth={size === "sm" ? 7 : 5}
          strokeLinecap="round"
        />
        {probability !== null && (
          <path
            d={`M ${start.x} ${start.y} A 40 40 0 0 1 ${filled.x} ${filled.y}`}
            fill="none"
            className={cn(
              "transition-all duration-700 ease-out",
              tone === "strong"
                ? "stroke-success"
                : tone === "middling"
                  ? "stroke-attention"
                  : "stroke-failure",
            )}
            strokeWidth={size === "sm" ? 7 : 5}
            strokeLinecap="round"
          />
        )}
        {size !== "sm" &&
          TICKS.map((tick) => {
            const outer = polar(tick, 47);
            const inner = polar(tick, tick === 0.5 ? 43 : 45);

            return (
              <line
                key={tick}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                className="stroke-muted-foreground/40"
                strokeWidth={0.6}
              />
            );
          })}
        <g
          className="origin-[50px_50px] transition-transform duration-1000 ease-[cubic-bezier(.34,1.56,.64,1)]"
          style={{ transform: `rotate(${value * 180 - 90}deg)` }}
        >
          <line
            x1={50}
            y1={50}
            x2={50}
            y2={size === "sm" ? 18 : 14}
            className="stroke-foreground"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
        <circle cx={50} cy={50} r={2.6} className="fill-foreground" />
      </svg>
      <figcaption className="-mt-1 flex flex-col items-center">
        <span
          className={cn(
            "font-mono tabular-nums",
            size === "lg" ? "text-xl" : "text-sm",
            tone ? PROBABILITY_TEXT_CLASS[tone] : "text-muted-foreground",
          )}
        >
          {probability === null ? "··" : formatProbabilityPercent(probability)}
        </span>
        {label && <span className="text-xs text-muted-foreground">{label}</span>}
      </figcaption>
    </figure>
  );
}
