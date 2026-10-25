import { balanceGains } from "@ngriffin_uk/polychat-utility-core";
import type { ReactNode } from "react";

import { cn } from "../utils";

export interface MediaBalanceSide {
  label: string;
  icon: ReactNode;
}

function Side({ side, tone }: { side: MediaBalanceSide; tone: "default" | "overlay" }) {
  return (
    <span
      className={cn(
        "flex w-14 shrink-0 flex-col items-center gap-1 text-[0.7rem]",
        tone === "overlay" ? "text-white/85" : "text-muted-foreground",
      )}
    >
      {side.icon}
      {side.label}
    </span>
  );
}

export function MediaBalance({
  value,
  onChange,
  left,
  right,
  tone = "default",
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  left: MediaBalanceSide;
  right: MediaBalanceSide;
  tone?: "default" | "overlay";
  className?: string;
}) {
  const gains = balanceGains(value);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Side side={left} tone={tone} />
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label={`Balance between ${left.label.toLowerCase()} and ${right.label.toLowerCase()}`}
        aria-valuetext={`${left.label} ${Math.round(gains.left * 100)}%, ${right.label} ${Math.round(gains.right * 100)}%`}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        onDoubleClick={() => onChange(0.5)}
        className={cn(
          "h-6 min-w-0 flex-1 cursor-pointer appearance-none bg-transparent focus-visible:outline-none",
          "[&::-webkit-slider-runnable-track]:h-[3px] [&::-webkit-slider-runnable-track]:rounded-full",
          "[&::-webkit-slider-thumb]:-mt-[10px] [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md",
          "[&::-moz-range-track]:h-[3px] [&::-moz-range-track]:rounded-full",
          "[&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md",
          tone === "overlay"
            ? "[&::-moz-range-thumb]:bg-white [&::-moz-range-track]:bg-white/35 [&::-webkit-slider-runnable-track]:bg-white/35 [&::-webkit-slider-thumb]:bg-white"
            : "[&::-moz-range-thumb]:bg-foreground [&::-moz-range-track]:bg-border-strong [&::-webkit-slider-runnable-track]:bg-border-strong [&::-webkit-slider-thumb]:bg-foreground",
          "focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-active-work",
        )}
      />
      <Side side={right} tone={tone} />
    </div>
  );
}
