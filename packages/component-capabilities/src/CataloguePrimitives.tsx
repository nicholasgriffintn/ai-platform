import { Skeleton } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function CatalogueSection({
  id,
  headingId,
  eyebrow,
  title,
  lede,
  children,
}: {
  id: string;
  headingId: string;
  eyebrow: string;
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-20 space-y-5">
      <div className="space-y-2">
        <p className="polychat-eyebrow">{eyebrow}</p>
        <h2
          id={headingId}
          className="font-display text-foreground text-3xl font-medium tracking-tight text-balance"
        >
          {title}
        </h2>
        <p className="text-muted-foreground max-w-prose leading-relaxed">{lede}</p>
      </div>
      {children}
    </section>
  );
}

export function CatalogueCard({
  icon,
  title,
  description,
  badges,
  footer,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badges?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <li className="bg-surface border-border flex flex-col gap-3 rounded-xl border p-4 lg:flex-row">
      <span className="bg-surface-elevated text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-foreground text-sm font-medium">{title}</span>
          {badges}
        </div>
        <p className="text-muted-foreground line-clamp-3 text-xs leading-relaxed">{description}</p>
        {footer}
      </div>
    </li>
  );
}

export function CatalogueSkeletonGrid({ count }: { count: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <li key={index}>
          <Skeleton className="h-24 w-full rounded-xl" />
        </li>
      ))}
    </ul>
  );
}
