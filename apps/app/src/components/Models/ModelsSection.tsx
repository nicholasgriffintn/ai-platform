import type { ReactNode } from "react";

import type { SectionNavItem } from "~/components/Core/SectionNav";

export interface ModelsSectionProps {
  section: SectionNavItem;
  description: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export function ModelsSection({ section, description, aside, children }: ModelsSectionProps) {
  const headingId = `models-${section.id}-title`;

  return (
    <section
      id={section.id}
      aria-labelledby={headingId}
      className="border-border scroll-mt-20 space-y-6 border-t py-12 md:py-14"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2
            id={headingId}
            className="font-display text-foreground text-2xl font-medium tracking-tight md:text-3xl"
          >
            {section.label}
          </h2>
          <p className="text-muted-foreground max-w-prose text-sm leading-relaxed md:text-base">
            {description}
          </p>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </section>
  );
}
