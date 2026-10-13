import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function PlayingCard({
  corner,
  children,
  className,
}: {
  corner: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex aspect-[5/7] flex-col justify-center rounded-2xl border border-border-strong bg-card p-5 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.45)]",
        className,
      )}
    >
      <span className="absolute top-3 left-3.5 font-mono text-[10px] tracking-[0.14em] text-accent-rose uppercase">
        {corner}
      </span>
      <span className="absolute right-3.5 bottom-3 rotate-180 font-mono text-[10px] tracking-[0.14em] text-accent-rose uppercase">
        {corner}
      </span>
      {children}
    </div>
  );
}

export function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "aspect-[5/7] rounded-2xl border border-accent-rose/40 bg-card p-2 shadow-[0_18px_40px_-24px_rgb(0_0_0/0.45)]",
        className,
      )}
    >
      <div className="h-full w-full rounded-xl bg-[repeating-linear-gradient(45deg,color-mix(in_oklch,var(--color-accent-rose)_55%,transparent)_0_2px,transparent_2px_9px),repeating-linear-gradient(-45deg,color-mix(in_oklch,var(--color-accent-rose)_35%,transparent)_0_2px,transparent_2px_9px)]" />
    </div>
  );
}
