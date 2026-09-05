import type { ReactNode } from "react";

export interface DiscoverBandProps {
  id: string;
  eyebrow: string;
  title: string;
  lede: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function DiscoverBand({ id, eyebrow, title, lede, actions, children }: DiscoverBandProps) {
  const headingId = `discover-${id}-title`;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="border-border scroll-mt-20 border-t py-12 first:border-t-0 first:pt-0 md:py-16"
    >
      <div className="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-12">
        <div className="space-y-4">
          <p className="polychat-eyebrow">{eyebrow}</p>
          <h2
            id={headingId}
            className="font-display text-foreground text-3xl font-medium tracking-tight text-balance md:text-4xl"
          >
            {title}
          </h2>
          <p className="text-muted-foreground max-w-prose text-base leading-relaxed">{lede}</p>
          {actions && <div className="flex flex-wrap gap-3 pt-2">{actions}</div>}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
