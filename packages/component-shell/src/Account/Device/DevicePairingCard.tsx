import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Check, Globe, SquareTerminal, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export type DevicePairingState = "waiting" | "linked" | "refused";

const LINE_STYLES: Record<DevicePairingState, string> = {
  waiting: "border-dashed border-border-strong",
  linked: "border-solid border-success",
  refused: "border-dashed border-failure/60",
};

function PairingEnd({ children, state }: { children: ReactNode; state: DevicePairingState }) {
  return (
    <span
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border bg-canvas",
        state === "linked" ? "border-success/50 text-success" : "border-border text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function PairingLink({ state, device: Device }: { state: DevicePairingState; device: LucideIcon }) {
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <PairingEnd state={state}>
        <Device className="h-5 w-5" />
      </PairingEnd>
      <div className="relative flex w-20 items-center sm:w-24">
        <span className={cn("polychat-motion-panel w-full border-t-2", LINE_STYLES[state])} />
        <span
          className={cn(
            "absolute left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border bg-surface",
            state === "linked" && "border-success text-success",
            state === "refused" && "border-failure/60 text-failure",
            state === "waiting" && "polychat-motion-ambient border-active-work/60",
          )}
        >
          {state === "linked" ? <Check className="h-3.5 w-3.5" /> : null}
          {state === "refused" ? <X className="h-3.5 w-3.5" /> : null}
          {state === "waiting" ? (
            <span className="h-1.5 w-1.5 rounded-full bg-active-work" />
          ) : null}
        </span>
      </div>
      <PairingEnd state={state}>
        <Globe className="h-5 w-5" />
      </PairingEnd>
    </div>
  );
}

interface DevicePairingCardProps {
  state: DevicePairingState;
  eyebrow: string;
  title: ReactNode;
  device?: LucideIcon;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

export function DevicePairingCard({
  state,
  eyebrow,
  title,
  device = SquareTerminal,
  description,
  children,
  footer,
}: DevicePairingCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-6 pb-12 sm:pt-14">
      <section className="polychat-motion-enter flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <PairingLink state={state} device={device} />
        <header className="flex flex-col items-center gap-2 text-center">
          <p className="polychat-eyebrow">{eyebrow}</p>
          <h1 className="font-display text-2xl font-medium tracking-tight text-balance">{title}</h1>
          {description ? (
            <p className="text-sm leading-relaxed text-pretty text-muted-foreground">
              {description}
            </p>
          ) : null}
        </header>
        {children}
      </section>
      {footer ? (
        <div className="polychat-motion-enter polychat-motion-stagger-1">{footer}</div>
      ) : null}
    </div>
  );
}
