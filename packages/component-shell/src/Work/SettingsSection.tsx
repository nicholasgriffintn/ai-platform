import type { ReactNode } from "react";

export function SettingsSection({
  id,
  icon,
  title,
  description,
  action,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 rounded-xl border border-border bg-surface p-5">
      <header className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-selection text-muted-foreground">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </header>
      {children ? <div className="mt-4 sm:pl-12">{children}</div> : null}
    </section>
  );
}

export function SettingsFrame({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section
      id={id}
      className="scroll-mt-6 overflow-hidden rounded-xl border border-border bg-surface"
    >
      {children}
    </section>
  );
}
