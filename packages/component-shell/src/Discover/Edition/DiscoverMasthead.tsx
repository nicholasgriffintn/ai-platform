import type { ReactNode } from "react";

export interface DiscoverGreeting {
  opener: string;
  name: string | null;
}

export function DiscoverMasthead({
  today,
  greeting,
  children,
}: {
  today: string;
  greeting: DiscoverGreeting;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 @5xl/discover:flex-row @5xl/discover:items-start @5xl/discover:gap-10">
      <div className="flex shrink-0 flex-col gap-2 @5xl/discover:w-[24rem]">
        <p className="polychat-eyebrow">{today}</p>
        <h1 className="font-display text-[2.25rem] leading-[1.05] font-medium tracking-tight text-foreground sm:text-[2.75rem]">
          {greeting.opener}
          {greeting.name && (
            <>
              , <em>{greeting.name}</em>
            </>
          )}
        </h1>
      </div>
      {children ? (
        <div className="@container/brief min-w-0 flex-1 @5xl/discover:border-l @5xl/discover:border-border @5xl/discover:pt-1 @5xl/discover:pl-10">
          {children}
        </div>
      ) : null}
    </header>
  );
}
