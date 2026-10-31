import type { ReactNode } from "react";

export function DiscoverStage({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div data-stagger className="flex min-w-0 flex-col gap-1.5">
        <p className="polychat-eyebrow">{eyebrow}</p>
        <h2 className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-tight text-balance text-foreground xl:text-3xl">
          {title}
        </h2>
        {subtitle ? (
          <p title={subtitle} className="line-clamp-2 text-sm text-pretty text-muted-foreground">
            {subtitle}
          </p>
        ) : null}
      </div>
      <div data-stagger className="flex flex-col gap-5">
        {children}
      </div>
    </div>
  );
}
