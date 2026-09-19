import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";
import { Children, useState, type ReactNode } from "react";

import { SiteIcon } from "../icons.js";
import { HEADING_FONT, Initials, SiteLink } from "../ui.js";

type WithChildren<T> = T & { children?: ReactNode };

export function Page({ children }: WithChildren<SiteComponentProps<"Page">>) {
  return <main className="flex min-h-full flex-col bg-background text-foreground">{children}</main>;
}

const SECTION_BACKGROUNDS = {
  default: "bg-background",
  muted: "bg-muted/50",
  primary: "bg-primary text-primary-foreground",
  inverted: "bg-foreground text-background",
} as const;
const SECTION_PADDINGS = { sm: "py-8", md: "py-14", lg: "py-24" } as const;
const SECTION_WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

export function Section({
  background = "default",
  padding = "md",
  width = "default",
  anchor,
  children,
}: WithChildren<SiteComponentProps<"Section">>) {
  return (
    <section
      id={anchor}
      className={cn("w-full", SECTION_BACKGROUNDS[background], SECTION_PADDINGS[padding])}
    >
      <div className={cn("mx-auto flex w-full flex-col gap-6 px-6", SECTION_WIDTHS[width])}>
        {children}
      </div>
    </section>
  );
}

const GAPS = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-8",
  xl: "gap-12",
} as const;
const ALIGN = { start: "items-start", center: "items-center", end: "items-end" } as const;
const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

export function Stack({
  direction = "vertical",
  gap = "md",
  align,
  justify,
  wrap,
  children,
}: WithChildren<SiteComponentProps<"Stack">>) {
  return (
    <div
      className={cn(
        "flex",
        direction === "horizontal" ? "flex-row" : "flex-col",
        GAPS[gap],
        align && ALIGN[align],
        justify && JUSTIFY[justify],
        wrap && "flex-wrap",
      )}
    >
      {children}
    </div>
  );
}

const COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
} as const;

export function Grid({
  columns = 3,
  gap = "md",
  children,
}: WithChildren<SiteComponentProps<"Grid">>) {
  const columnClass = COLUMNS[Math.min(6, Math.max(1, columns)) as keyof typeof COLUMNS];

  return <div className={cn("grid", columnClass, GAPS[gap])}>{children}</div>;
}

const CARD_VARIANTS = {
  default: "border bg-card shadow-sm",
  outline: "border bg-transparent",
  elevated: "border bg-card shadow-lg",
  ghost: "bg-transparent",
} as const;
const CARD_PADDINGS = { none: "p-0", sm: "p-4", md: "p-6", lg: "p-8" } as const;

export function Card({
  title,
  description,
  variant = "default",
  padding = "md",
  children,
}: WithChildren<SiteComponentProps<"Card">>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg text-card-foreground",
        CARD_VARIANTS[variant],
        CARD_PADDINGS[padding],
      )}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && (
            <h3 className={cn("text-lg leading-tight font-semibold", HEADING_FONT)}>{title}</h3>
          )}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function Divider({ label }: SiteComponentProps<"Divider">) {
  if (!label) {
    return <hr className="border-border" />;
  }

  return (
    <div className="flex items-center gap-3 text-xs tracking-wide text-muted-foreground uppercase">
      <hr className="flex-1 border-border" />
      <span>{label}</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}

const SPACER_SIZES = { sm: "h-4", md: "h-8", lg: "h-16" } as const;

export function Spacer({ size = "md" }: SiteComponentProps<"Spacer">) {
  return <div aria-hidden="true" className={SPACER_SIZES[size]} />;
}

export function Tabs({ tabs, defaultValue, children }: WithChildren<SiteComponentProps<"Tabs">>) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);
  const panels = Children.toArray(children);
  const index = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === active),
  );

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" className="inline-flex w-fit items-center gap-1 rounded-md bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={tab.value === active}
            onClick={() => setActive(tab.value)}
            className={cn(
              "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
              tab.value === active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{panels[index] ?? null}</div>
    </div>
  );
}

export function AppShell({
  brand,
  nav,
  user,
  title,
  children,
}: WithChildren<SiteComponentProps<"AppShell">>) {
  return (
    <div className="flex min-h-full w-full bg-muted/30 text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className={cn("flex h-14 items-center px-5 text-base font-semibold", HEADING_FONT)}>
          {brand}
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {nav.map((item) => (
            <SiteLink
              key={item.href + item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                item.active
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <SiteIcon name={item.icon} size="sm" />
              {item.label}
            </SiteLink>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-3 border-t px-5 py-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              <Initials name={user.name} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              {user.email && (
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              )}
            </span>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
          <span className={cn("text-base font-semibold md:hidden", HEADING_FONT)}>{brand}</span>
          {title && <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>}
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </div>
    </div>
  );
}
