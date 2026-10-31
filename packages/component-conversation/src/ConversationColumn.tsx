import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode, Ref } from "react";

export interface ConversationColumnProps {
  children: ReactNode;
}

export function ConversationMessageColumn({ children }: ConversationColumnProps) {
  return (
    <div className="min-h-0 flex-1 px-4">
      <div className="mx-auto flex h-full w-full max-w-[52rem] flex-col gap-8">{children}</div>
    </div>
  );
}

export function ConversationComposerDock({
  children,
  floating = false,
  ref,
}: ConversationColumnProps & { floating?: boolean; ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className={cn(
        "z-10 px-4",
        floating
          ? "pointer-events-none absolute inset-x-0 bottom-0 pt-12 [background:linear-gradient(to_top,var(--background)_calc(100%-3rem),transparent)]"
          : "relative shrink-0 pt-2 md:z-auto",
      )}
    >
      <div className="pointer-events-auto mx-auto max-w-[52rem]">{children}</div>
    </div>
  );
}

export function ConversationWelcomeStarters({
  title,
  children,
}: {
  title: string | undefined;
  children: ReactNode;
}) {
  return (
    <section data-welcome-starters className="flex flex-col gap-2 px-4 pt-2 pb-6">
      {title ? (
        <div className="flex items-center gap-3 px-1">
          <h3 className="polychat-eyebrow">{title}</h3>
          <span aria-hidden className="h-px flex-1 bg-border" />
        </div>
      ) : null}
      {children}
    </section>
  );
}
