import type { SiteComponentType } from "../catalog.js";

const HEADER = `import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
`;

const CLIENT_DIRECTIVE = '"use client";\n\n';

const layout = (body: string) => {
  const client = body.startsWith(CLIENT_DIRECTIVE);
  const source = client ? body.slice(CLIENT_DIRECTIVE.length) : body;

  return `${client ? CLIENT_DIRECTIVE : ""}${HEADER}\n${source}`;
};

export const SITE_COMPONENT_TEMPLATES: Record<SiteComponentType, string> = {
  Page: layout(`export default function Page({ children }: { children?: ReactNode }) {
  return <main className="flex min-h-screen flex-col bg-background text-foreground">{children}</main>;
}
`),

  Section: layout(`const BACKGROUNDS = {
  default: "bg-background",
  muted: "bg-muted/50",
  primary: "bg-primary text-primary-foreground",
  inverted: "bg-foreground text-background",
} as const;

const PADDINGS = { sm: "py-8", md: "py-14", lg: "py-24" } as const;
const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-6xl",
  wide: "max-w-7xl",
  full: "max-w-none",
} as const;

export default function Section({
  background = "default",
  padding = "md",
  width = "default",
  anchor,
  children,
}: {
  background?: keyof typeof BACKGROUNDS;
  padding?: keyof typeof PADDINGS;
  width?: keyof typeof WIDTHS;
  anchor?: string;
  children?: ReactNode;
}) {
  return (
    <section id={anchor} className={cn("w-full", BACKGROUNDS[background], PADDINGS[padding])}>
      <div className={cn("mx-auto flex w-full flex-col gap-6 px-6", WIDTHS[width])}>{children}</div>
    </section>
  );
}
`),

  Stack:
    layout(`const GAPS = { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-4", lg: "gap-8", xl: "gap-12" } as const;
const ALIGN = { start: "items-start", center: "items-center", end: "items-end" } as const;
const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

export default function Stack({
  direction = "vertical",
  gap = "md",
  align,
  justify,
  wrap,
  children,
}: {
  direction?: "vertical" | "horizontal";
  gap?: keyof typeof GAPS;
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  children?: ReactNode;
}) {
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
`),

  Grid: layout(`const COLUMNS = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
} as const;
const GAPS = { none: "gap-0", xs: "gap-1", sm: "gap-2", md: "gap-4", lg: "gap-8", xl: "gap-12" } as const;

export default function Grid({
  columns = 3,
  gap = "md",
  children,
}: {
  columns?: keyof typeof COLUMNS;
  gap?: keyof typeof GAPS;
  children?: ReactNode;
}) {
  return <div className={cn("grid", COLUMNS[columns], GAPS[gap])}>{children}</div>;
}
`),

  Card: layout(
    `const VARIANTS = {
  default: "border bg-card shadow-sm",
  outline: "border bg-transparent",
  elevated: "border bg-card shadow-lg",
  ghost: "bg-transparent",
} as const;
const PADDINGS = { none: "p-0", sm: "p-4", md: "p-6", lg: "p-8" } as const;

export default function Card({
  title,
  description,
  variant = "default",
  padding = "md",
  children,
}: {
  title?: string;
  description?: string;
  variant?: keyof typeof VARIANTS;
  padding?: keyof typeof PADDINGS;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-lg text-card-foreground", VARIANTS[variant], PADDINGS[padding])}>
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && <h3 className="font-heading text-lg font-semibold leading-tight">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
`,
  ),

  Divider: layout(`export default function Divider({ label }: { label?: string }) {
  if (!label) {
    return <hr className="border-border" />;
  }

  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <hr className="flex-1 border-border" />
      <span>{label}</span>
      <hr className="flex-1 border-border" />
    </div>
  );
}
`),

  Spacer: layout(`const SIZES = { sm: "h-4", md: "h-8", lg: "h-16" } as const;

export default function Spacer({ size = "md" }: { size?: keyof typeof SIZES }) {
  return <div aria-hidden="true" className={cn(SIZES[size])} />;
}
`),

  Tabs: layout(
    `"use client";

import { Children, useState } from "react";

export default function Tabs({
  tabs,
  defaultValue,
  value,
  onChange,
  children,
}: {
  tabs: Array<{ label: string; value: string }>;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  children?: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultValue ?? tabs[0]?.value);
  const active = value ?? (onChange ? defaultValue : undefined) ?? internal;
  const setActive = (next: string) => {
    setInternal(next);
    onChange?.(next);
  };
  const panels = Children.toArray(children);
  const index = Math.max(0, tabs.findIndex((tab) => tab.value === active));

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
              tab.value === active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
`,
  ),

  AppShell: layout(
    `import Link from "next/link";

import { Icon } from "@/components/site/icon";
import { Initials } from "@/components/site/ui";

export default function AppShell({
  brand,
  nav,
  user,
  title,
  children,
}: {
  brand: string;
  nav: Array<{ label: string; href: string; icon?: string; active?: boolean }>;
  user?: { name: string; email?: string };
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen w-full bg-muted/30 text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
        <div className="flex h-14 items-center px-5 font-heading text-base font-semibold">{brand}</div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
          {nav.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                item.active ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon name={item.icon} size="sm" />
              {item.label}
            </Link>
          ))}
        </nav>
        {user && (
          <div className="flex items-center gap-3 border-t px-5 py-4">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              <Initials name={user.name} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              {user.email && <span className="truncate text-xs text-muted-foreground">{user.email}</span>}
            </span>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
          <span className="font-heading text-base font-semibold md:hidden">{brand}</span>
          {title && <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>}
        </header>
        <main className="flex flex-1 flex-col gap-6 p-6">{children}</main>
      </div>
    </div>
  );
}
`,
  ),

  Navbar: layout(
    `import Link from "next/link";

import { Action } from "@/components/site/ui";

export default function Navbar({
  brand,
  links,
  cta,
  sticky,
}: {
  brand: string;
  links: Array<{ label: string; href: string }>;
  cta?: { label: string; href: string };
  sticky?: boolean;
}) {
  return (
    <header className={cn("w-full border-b bg-background/90 backdrop-blur", sticky && "sticky top-0 z-40")}>
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
        <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
          {brand}
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link key={link.href + link.label} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
        {cta && (
          <Action href={cta.href} size="sm">
            {cta.label}
          </Action>
        )}
      </div>
    </header>
  );
}
`,
  ),

  Footer: layout(
    `import Link from "next/link";

export default function Footer({
  brand,
  tagline,
  columns,
  copyright,
}: {
  brand: string;
  tagline?: string;
  columns?: Array<{ title: string; links: Array<{ label: string; href: string }> }>;
  copyright?: string;
}) {
  return (
    <footer className="mt-auto w-full border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <div className="grid gap-10 md:grid-cols-[2fr_repeat(auto-fit,minmax(8rem,1fr))]">
          <div className="flex flex-col gap-2">
            <span className="font-heading text-lg font-semibold">{brand}</span>
            {tagline && <p className="max-w-xs text-sm text-muted-foreground">{tagline}</p>}
          </div>
          {columns?.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <span className="text-sm font-medium">{column.title}</span>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {copyright && <p className="text-xs text-muted-foreground">{copyright}</p>}
      </div>
    </footer>
  );
}
`,
  ),

  Breadcrumbs: layout(
    `import Link from "next/link";

export default function Breadcrumbs({ items }: { items: Array<{ label: string; href: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const last = index === items.length - 1;

          return (
            <li key={item.href + item.label} className="flex items-center gap-2">
              {last ? (
                <span aria-current="page" className="text-foreground">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              )}
              {!last && <span aria-hidden="true">/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
`,
  ),

  Hero: layout(
    `import { Action, Placeholder } from "@/components/site/ui";

const BACKGROUNDS = {
  default: "bg-background",
  muted: "bg-muted/50",
  gradient: "bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)]",
  inverted: "bg-foreground text-background",
} as const;

export default function Hero({
  eyebrow,
  headline,
  description,
  primaryCta,
  secondaryCta,
  layout = "centered",
  image,
  background = "default",
}: {
  eyebrow?: string;
  headline: string;
  description?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  layout?: "centered" | "left" | "split";
  image?: { src?: string; alt: string };
  background?: keyof typeof BACKGROUNDS;
}) {
  const centered = layout === "centered";
  const copy = (
    <div className={cn("flex flex-col gap-6", centered ? "items-center text-center" : "items-start text-left")}>
      {eyebrow && (
        <span className="inline-flex rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </span>
      )}
      <h1 className="max-w-3xl font-heading text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
        {headline}
      </h1>
      {description && <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>}
      {(primaryCta || secondaryCta) && (
        <div className="flex flex-wrap gap-3">
          {primaryCta && (
            <Action href={primaryCta.href} size="lg">
              {primaryCta.label}
            </Action>
          )}
          {secondaryCta && (
            <Action href={secondaryCta.href} size="lg" variant="outline">
              {secondaryCta.label}
            </Action>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section className={cn("w-full py-20 sm:py-28", BACKGROUNDS[background])}>
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-6",
          layout === "split" && "grid items-center gap-12 lg:grid-cols-2",
        )}
      >
        {copy}
        {layout === "split" && (
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            {image?.src ? (
              <img src={image.src} alt={image.alt} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <Placeholder label={image?.alt ?? "Product image"} className="aspect-[4/3] w-full" />
            )}
          </div>
        )}
      </div>
    </section>
  );
}
`,
  ),

  FeatureGrid: layout(
    `import { Icon } from "@/components/site/icon";

const COLUMNS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

export default function FeatureGrid({
  eyebrow,
  headline,
  description,
  items,
  columns = 3,
  variant = "cards",
}: {
  eyebrow?: string;
  headline?: string;
  description?: string;
  items: Array<{ icon?: string; title: string; description: string }>;
  columns?: keyof typeof COLUMNS;
  variant?: "cards" | "plain";
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
        {(eyebrow || headline || description) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {eyebrow && <span className="text-sm font-medium uppercase tracking-wide text-primary">{eyebrow}</span>}
            {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
            {description && <p className="text-lg text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className={cn("grid gap-6", COLUMNS[columns])}>
          {items.map((item) => (
            <div
              key={item.title}
              className={cn("flex flex-col gap-3", variant === "cards" && "rounded-lg border bg-card p-6 shadow-sm")}
            >
              {item.icon && (
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon name={item.icon} size="sm" />
                </span>
              )}
              <h3 className="font-heading text-lg font-semibold">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  ),

  Stats: layout(`export default function Stats({
  headline,
  items,
}: {
  headline?: string;
  items: Array<{ value: string; label: string }>;
}) {
  return (
    <section className="w-full border-y bg-muted/40 py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6">
        {headline && <h2 className="font-heading text-2xl font-semibold tracking-tight">{headline}</h2>}
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dd className="font-heading text-4xl font-semibold tracking-tight">{item.value}</dd>
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
`),

  LogoCloud:
    layout(`export default function LogoCloud({ title, logos }: { title?: string; logos: string[] }) {
  return (
    <section className="w-full py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6">
        {title && <p className="text-sm text-muted-foreground">{title}</p>}
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {logos.map((logo) => (
            <li key={logo} className="font-heading text-lg font-semibold tracking-tight text-muted-foreground/70">
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`),

  Testimonials: layout(
    `import { Initials } from "@/components/site/ui";

export default function Testimonials({
  headline,
  items,
  layout = "grid",
}: {
  headline?: string;
  items: Array<{ quote: string; author: string; role?: string }>;
  layout?: "grid" | "single";
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <div className={cn("grid gap-6", layout === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl")}>
          {items.map((item) => (
            <figure key={item.author + item.quote} className="flex flex-col justify-between gap-6 rounded-lg border bg-card p-6">
              <blockquote className="text-base leading-relaxed">“{item.quote}”</blockquote>
              <figcaption className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  <Initials name={item.author} />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{item.author}</span>
                  {item.role && <span className="text-xs text-muted-foreground">{item.role}</span>}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  ),

  Pricing: layout(
    `import { Check } from "lucide-react";

import { Action } from "@/components/site/ui";

export default function Pricing({
  headline,
  description,
  tiers,
}: {
  headline?: string;
  description?: string;
  tiers: Array<{
    name: string;
    price: string;
    period?: string;
    description?: string;
    features: string[];
    cta: { label: string; href: string };
    featured?: boolean;
  }>;
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6">
        {(headline || description) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
            {description && <p className="text-lg text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-6 rounded-lg border bg-card p-6",
                tier.featured && "border-primary ring-1 ring-primary shadow-lg",
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{tier.name}</span>
                <span className="flex items-baseline gap-1">
                  <span className="font-heading text-4xl font-semibold tracking-tight">{tier.price}</span>
                  {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
                </span>
                {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Action href={tier.cta.href} variant={tier.featured ? "primary" : "outline"} className="w-full">
                {tier.cta.label}
              </Action>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
`,
  ),

  FAQ: layout(`export default function FAQ({
  headline,
  items,
}: {
  headline?: string;
  items: Array<{ question: string; answer: string }>;
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {item.question}
                <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
`),

  CTA: layout(
    `import { Action } from "@/components/site/ui";

const VARIANTS = {
  default: "bg-background",
  primary: "bg-primary text-primary-foreground",
  muted: "bg-muted/50",
} as const;

export default function CTA({
  headline,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
}: {
  headline: string;
  description?: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  variant?: keyof typeof VARIANTS;
}) {
  const inverted = variant === "primary";

  return (
    <section className={cn("w-full py-16 sm:py-20", VARIANTS[variant])}>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>
        {description && <p className={cn("max-w-2xl text-lg", inverted ? "text-primary-foreground/80" : "text-muted-foreground")}>{description}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <Action href={primaryCta.href} size="lg" variant={inverted ? "secondary" : "primary"}>
            {primaryCta.label}
          </Action>
          {secondaryCta && (
            <Action href={secondaryCta.href} size="lg" variant={inverted ? "ghost" : "outline"}>
              {secondaryCta.label}
            </Action>
          )}
        </div>
      </div>
    </section>
  );
}
`,
  ),

  Steps: layout(`export default function Steps({
  headline,
  items,
  direction = "horizontal",
}: {
  headline?: string;
  items: Array<{ title: string; description: string }>;
  direction?: "horizontal" | "vertical";
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <ol className={cn("grid gap-8", direction === "horizontal" ? "md:grid-cols-3" : "max-w-2xl")}>
          {items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className="font-heading text-lg font-semibold">{item.title}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
`),

  Team: layout(
    `import { Initials } from "@/components/site/ui";

export default function Team({
  headline,
  members,
}: {
  headline?: string;
  members: Array<{ name: string; role: string; bio?: string; image?: { src?: string; alt: string } }>;
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member) => (
            <li key={member.name} className="flex flex-col gap-3">
              {member.image?.src ? (
                <img src={member.image.src} alt={member.image.alt} className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-muted font-heading text-3xl font-semibold text-muted-foreground">
                  <Initials name={member.name} />
                </span>
              )}
              <span className="flex flex-col">
                <span className="font-medium">{member.name}</span>
                <span className="text-sm text-muted-foreground">{member.role}</span>
              </span>
              {member.bio && <p className="text-sm text-muted-foreground">{member.bio}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
  ),

  Gallery: layout(
    `import { Placeholder } from "@/components/site/ui";

const COLUMNS = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;

export default function Gallery({
  headline,
  items,
  columns = 3,
}: {
  headline?: string;
  items: Array<{ src?: string; alt: string; caption?: string }>;
  columns?: keyof typeof COLUMNS;
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <ul className={cn("grid gap-6", COLUMNS[columns])}>
          {items.map((item) => (
            <li key={item.alt} className="flex flex-col gap-2">
              {item.src ? (
                <img src={item.src} alt={item.alt} className="aspect-[4/3] w-full rounded-lg object-cover" />
              ) : (
                <Placeholder label={item.alt} className="aspect-[4/3] w-full rounded-lg" />
              )}
              {item.caption && <span className="text-sm text-muted-foreground">{item.caption}</span>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
  ),

  Newsletter: layout(
    `import { Action, Field } from "@/components/site/ui";

export default function Newsletter({
  headline,
  description,
  placeholder = "you@example.com",
  buttonLabel = "Subscribe",
}: {
  headline: string;
  description?: string;
  placeholder?: string;
  buttonLabel?: string;
}) {
  return (
    <section className="w-full bg-muted/50 py-16">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <h2 className="font-heading text-3xl font-semibold tracking-tight">{headline}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
        <form className="flex w-full max-w-md flex-col gap-2 sm:flex-row" onSubmit={(event) => event.preventDefault()}>
          <Field type="email" placeholder={placeholder} aria-label="Email address" required />
          <Action>{buttonLabel}</Action>
        </form>
      </div>
    </section>
  );
}
`,
  ),

  Articles: layout(
    `import Link from "next/link";

export default function Articles({
  headline,
  items,
  layout = "grid",
}: {
  headline?: string;
  items: Array<{ title: string; excerpt?: string; date?: string; author?: string; href?: string; tag?: string }>;
  layout?: "grid" | "list";
}) {
  return (
    <section className="w-full py-16 sm:py-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6">
        {headline && <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">{headline}</h2>}
        <ul className={cn("grid gap-8", layout === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl")}>
          {items.map((item) => (
            <li key={item.title} className="flex flex-col gap-2">
              {item.tag && <span className="text-xs font-medium uppercase tracking-wide text-primary">{item.tag}</span>}
              <h3 className="font-heading text-xl font-semibold leading-snug">
                {item.href ? (
                  <Link href={item.href} className="hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  item.title
                )}
              </h3>
              {item.excerpt && <p className="text-sm text-muted-foreground">{item.excerpt}</p>}
              {(item.date || item.author) && (
                <span className="text-xs text-muted-foreground">{[item.author, item.date].filter(Boolean).join(" · ")}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
`,
  ),

  Heading: layout(`const SIZES = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl sm:text-4xl",
  xl: "text-4xl sm:text-5xl",
  display: "text-5xl sm:text-6xl",
} as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;

export default function Heading({
  text,
  level = 2,
  size = "md",
  align,
}: {
  text: string;
  level?: 1 | 2 | 3 | 4;
  size?: keyof typeof SIZES;
  align?: keyof typeof ALIGN;
}) {
  const Tag = ("h" + level) as "h1" | "h2" | "h3" | "h4";

  return <Tag className={cn("font-heading font-semibold tracking-tight", SIZES[size], align && ALIGN[align])}>{text}</Tag>;
}
`),

  Text: layout(`const SIZES = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" } as const;
const TONES = { default: "text-foreground", muted: "text-muted-foreground", primary: "text-primary" } as const;
const WEIGHTS = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" } as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;

export default function Text({
  text,
  size = "md",
  tone = "default",
  weight = "normal",
  align,
}: {
  text: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  weight?: keyof typeof WEIGHTS;
  align?: keyof typeof ALIGN;
}) {
  return <p className={cn("leading-relaxed", SIZES[size], TONES[tone], WEIGHTS[weight], align && ALIGN[align])}>{text}</p>;
}
`),

  Badge: layout(`const VARIANTS = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border text-foreground",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  danger: "bg-destructive/15 text-destructive",
} as const;

export default function Badge({ text, variant = "default" }: { text: string; variant?: keyof typeof VARIANTS }) {
  return <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium", VARIANTS[variant])}>{text}</span>;
}
`),

  Button: layout(
    `import { Icon } from "@/components/site/icon";
import { Action, type ButtonSize, type ButtonVariant } from "@/components/site/ui";

export default function Button({
  label,
  href,
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  onPress,
}: {
  label: string;
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  fullWidth?: boolean;
  onPress?: () => void;
}) {
  return (
    <Action href={href} variant={variant} size={size} className={cn(fullWidth && "w-full")} onPress={onPress}>
      <Icon name={icon} size="sm" />
      {label}
    </Action>
  );
}
`,
  ),

  Link: layout(
    `import NextLink from "next/link";

import { Icon } from "@/components/site/icon";

export default function Link({ label, href, icon }: { label: string; href: string; icon?: string }) {
  return (
    <NextLink href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
      {label}
      <Icon name={icon} size="sm" />
    </NextLink>
  );
}
`,
  ),

  Image: layout(
    `import { Placeholder } from "@/components/site/ui";

const ASPECTS = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-[3/4]",
  wide: "aspect-[21/9]",
  auto: "",
} as const;

export default function Image({
  src,
  alt,
  aspect = "video",
  rounded = true,
}: {
  src?: string;
  alt: string;
  aspect?: keyof typeof ASPECTS;
  rounded?: boolean;
}) {
  const classes = cn("w-full object-cover", ASPECTS[aspect], rounded && "rounded-lg");

  return src ? <img src={src} alt={alt} className={classes} /> : <Placeholder label={alt} className={cn(classes, !ASPECTS[aspect] && "aspect-video")} />;
}
`,
  ),

  Icon: layout(
    `import { Icon as SiteIcon } from "@/components/site/icon";

const TONES = { default: "text-foreground", muted: "text-muted-foreground", primary: "text-primary" } as const;

export default function Icon({
  name,
  size = "md",
  tone = "default",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: keyof typeof TONES;
}) {
  return (
    <span className={cn("inline-flex", TONES[tone])}>
      <SiteIcon name={name} size={size} />
    </span>
  );
}
`,
  ),

  Avatar: layout(
    `import { Initials } from "@/components/site/ui";

const SIZES = { sm: "size-8 text-xs", md: "size-10 text-sm", lg: "size-14 text-base" } as const;

export default function Avatar({ name, src, size = "md" }: { name: string; src?: string; size?: keyof typeof SIZES }) {
  return src ? (
    <img src={src} alt={name} className={cn("rounded-full object-cover", SIZES[size])} />
  ) : (
    <span className={cn("flex items-center justify-center rounded-full bg-muted font-medium", SIZES[size])} title={name}>
      <Initials name={name} />
    </span>
  );
}
`,
  ),

  List: layout(
    `import { Check } from "lucide-react";

export default function List({ items, style = "bullet" }: { items: string[]; style?: "bullet" | "number" | "check" }) {
  if (style === "number") {
    return (
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    );
  }

  return (
    <ul className={cn("space-y-1 text-sm", style === "bullet" && "list-disc pl-5")}>
      {items.map((item) => (
        <li key={item} className={cn(style === "check" && "flex items-start gap-2")}>
          {style === "check" && <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
          {item}
        </li>
      ))}
    </ul>
  );
}
`,
  ),

  Quote:
    layout(`export default function Quote({ text, author, role }: { text: string; author?: string; role?: string }) {
  return (
    <figure className="flex flex-col gap-4 border-l-2 border-primary pl-6">
      <blockquote className="font-heading text-xl leading-relaxed">“{text}”</blockquote>
      {author && (
        <figcaption className="text-sm text-muted-foreground">
          {author}
          {role ? ", " + role : ""}
        </figcaption>
      )}
    </figure>
  );
}
`),

  Code: layout(`export default function Code({ code, language, title }: { code: string; language?: string; title?: string }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-muted/40">
      {(title || language) && (
        <div className="flex items-center justify-between border-b px-4 py-2 text-xs text-muted-foreground">
          <span>{title}</span>
          <span>{language}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}
`),

  Alert: layout(
    `import { Icon } from "@/components/site/icon";

const VARIANTS = {
  info: { classes: "border-border bg-muted/40", icon: "info" },
  success: { classes: "border-emerald-500/40 bg-emerald-500/10", icon: "check" },
  warning: { classes: "border-amber-500/40 bg-amber-500/10", icon: "alert" },
  danger: { classes: "border-destructive/40 bg-destructive/10", icon: "alert" },
} as const;

export default function Alert({
  title,
  description,
  variant = "info",
}: {
  title: string;
  description?: string;
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-lg border p-4", VARIANTS[variant].classes)}>
      <Icon name={VARIANTS[variant].icon} size="sm" className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </div>
    </div>
  );
}
`,
  ),

  Metric: layout(
    `import { Icon } from "@/components/site/icon";

const TRENDS = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-destructive",
  flat: "text-muted-foreground",
} as const;

export default function Metric({
  label,
  value,
  change,
  trend = "flat",
  icon,
}: {
  label: string;
  value: string;
  change?: string;
  trend?: keyof typeof TRENDS;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-5">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{label}</span>
        <Icon name={icon} size="sm" />
      </div>
      <span className="font-heading text-3xl font-semibold tracking-tight">{value}</span>
      {change && <span className={cn("text-xs font-medium", TRENDS[trend])}>{change}</span>}
    </div>
  );
}
`,
  ),

  Progress: layout(`export default function Progress({
  value,
  label,
  showValue,
}: {
  value: number;
  label?: string;
  showValue?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="flex flex-col gap-2">
      {(label || showValue) && (
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          {showValue && <span className="text-muted-foreground">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100} className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: clamped + "%" }} />
      </div>
    </div>
  );
}
`),

  Chart: layout(`const HEIGHTS = { sm: 120, md: 200, lg: 300 } as const;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function polar(cx: number, cy: number, r: number, angle: number) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

export default function Chart({
  type,
  title,
  data,
  height = "md",
}: {
  type: "bar" | "line" | "area" | "donut";
  title?: string;
  data: Array<{ label: string; value: number }>;
  height?: keyof typeof HEIGHTS;
}) {
  const h = HEIGHTS[height];
  const w = 600;
  const max = Math.max(1, ...data.map((point) => point.value));
  const total = data.reduce((sum, point) => sum + point.value, 0) || 1;

  let body: ReactNode;

  if (type === "donut") {
    let angle = -Math.PI / 2;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 8;

    body = data.map((point, index) => {
      const sweep = (point.value / total) * Math.PI * 2;
      const [x1, y1] = polar(cx, cy, r, angle);
      const [x2, y2] = polar(cx, cy, r, angle + sweep);
      const large = sweep > Math.PI ? 1 : 0;
      const d = "M " + x1 + " " + y1 + " A " + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2 + " L " + cx + " " + cy + " Z";

      angle += sweep;

      return <path key={point.label} d={d} fill={COLORS[index % COLORS.length]} stroke="var(--card)" strokeWidth={2} />;
    });
    body = (
      <>
        {body}
        <circle cx={cx} cy={cy} r={r * 0.55} fill="var(--card)" />
      </>
    );
  } else {
    const gap = 8;
    const slot = w / Math.max(1, data.length);
    const points = data.map((point, index) => {
      const x = slot * index + slot / 2;
      const y = h - 24 - (point.value / max) * (h - 40);

      return [x, y] as const;
    });
    const path = points.map(([x, y], index) => (index === 0 ? "M" : "L") + " " + x + " " + y).join(" ");

    body = (
      <>
        {type === "bar" &&
          points.map(([x, y], index) => (
            <rect
              key={data[index].label}
              x={x - slot / 2 + gap}
              y={y}
              width={Math.max(4, slot - gap * 2)}
              height={h - 24 - y}
              rx={4}
              fill="var(--chart-1)"
            />
          ))}
        {type === "area" && (
          <path d={path + " L " + points[points.length - 1]?.[0] + " " + (h - 24) + " L " + points[0]?.[0] + " " + (h - 24) + " Z"} fill="var(--chart-1)" opacity={0.2} />
        )}
        {(type === "line" || type === "area") && <path d={path} fill="none" stroke="var(--chart-1)" strokeWidth={2.5} />}
        {data.map((point, index) => (
          <text key={point.label} x={points[index][0]} y={h - 6} textAnchor="middle" fontSize={11} fill="var(--muted-foreground)">
            {point.label}
          </text>
        ))}
      </>
    );
  }

  return (
    <figure className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      {title && <figcaption className="text-sm font-medium">{title}</figcaption>}
      <svg viewBox={"0 0 " + w + " " + h} className="h-auto w-full" role="img" aria-label={title ?? type + " chart"}>
        {body}
      </svg>
      {type === "donut" && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {data.map((point, index) => (
            <li key={point.label} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />
              {point.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
`),

  Table: layout(`export default function Table({
  caption,
  columns,
  rows,
  striped,
}: {
  caption?: string;
  columns: Array<{ key: string; label: string; align?: "start" | "end" }>;
  rows: Array<Record<string, string>>;
  striped?: boolean;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        {caption && <caption className="px-4 py-3 text-left text-sm font-medium">{caption}</caption>}
        <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={cn("px-4 py-3 font-medium", column.align === "end" ? "text-right" : "text-left")}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className={cn("border-b last:border-0", striped && index % 2 === 1 && "bg-muted/20")}>
              {columns.map((column) => (
                <td key={column.key} className={cn("px-4 py-3", column.align === "end" ? "text-right tabular-nums" : "text-left")}>
                  {row[column.key] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`),

  KeyValue:
    layout(`export default function KeyValue({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="divide-y rounded-lg border bg-card text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-6 px-4 py-3">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="text-right font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
`),

  EmptyState: layout(
    `import { Icon } from "@/components/site/icon";
import { Action } from "@/components/site/ui";

export default function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
      {icon && (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon name={icon} size="sm" />
        </span>
      )}
      <span className="font-medium">{title}</span>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && (
        <Action href={action.href} size="sm">
          {action.label}
        </Action>
      )}
    </div>
  );
}
`,
  ),

  Form: layout(
    `import { Action, Field, FieldLabel, SelectField, TextField } from "@/components/site/ui";

export default function Form({
  title,
  description,
  fields,
  submitLabel,
  layout = "stacked",
  onSubmit,
}: {
  title?: string;
  description?: string;
  fields: Array<{
    name: string;
    label: string;
    type: "text" | "email" | "password" | "number" | "textarea" | "select" | "checkbox";
    placeholder?: string;
    required?: boolean;
    options?: string[];
  }>;
  submitLabel: string;
  layout?: "stacked" | "inline";
  onSubmit?: (values: Record<string, unknown>) => void;
}) {
  return (
    <form
      className="flex w-full max-w-xl flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();

        if (!onSubmit) {
          return;
        }

        const form = event.currentTarget;
        const values = Object.fromEntries(
          fields.map((field) => {
            const control = form.elements.namedItem(field.name);
            const value =
              control instanceof HTMLInputElement && field.type === "checkbox"
                ? control.checked
                : control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement
                  ? control.value
                  : "";

            return [field.name, value];
          }),
        );

        onSubmit(values);
        form.reset();
      }}
    >
      {(title || description) && (
        <div className="flex flex-col gap-1">
          {title && <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn("grid gap-4", layout === "inline" && "sm:grid-cols-2")}>
        {fields.map((field) => {
          const id = "field-" + field.name;

          if (field.type === "checkbox") {
            return (
              <label key={field.name} htmlFor={id} className="flex items-center gap-2 text-sm">
                <input id={id} name={field.name} type="checkbox" required={field.required} className="size-4 rounded border-input accent-primary" />
                {field.label}
              </label>
            );
          }

          return (
            <div key={field.name} className={cn("flex flex-col gap-2", field.type === "textarea" && "sm:col-span-2")}>
              <FieldLabel htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive"> *</span>}
              </FieldLabel>
              {field.type === "textarea" ? (
                <TextField id={id} name={field.name} placeholder={field.placeholder} required={field.required} />
              ) : field.type === "select" ? (
                <SelectField id={id} name={field.name} required={field.required} defaultValue="">
                  <option value="" disabled>
                    {field.placeholder ?? "Select"}
                  </option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </SelectField>
              ) : (
                <Field id={id} name={field.name} type={field.type} placeholder={field.placeholder} required={field.required} />
              )}
            </div>
          );
        })}
      </div>
      <Action className="w-fit" type="submit">
        {submitLabel}
      </Action>
    </form>
  );
}
`,
  ),

  Input: layout(
    `import { Icon } from "@/components/site/icon";
import { Field, FieldLabel } from "@/components/site/ui";

export default function Input({
  label,
  placeholder,
  type = "text",
  icon,
  value,
  onChange,
}: {
  label?: string;
  placeholder?: string;
  type?: "text" | "email" | "search" | "number";
  icon?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
            <Icon name={icon} size="sm" />
          </span>
        )}
        <Field
          type={type}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
          className={cn(icon && "pl-9")}
          {...(onChange ? { value: value ?? "", onChange: (event) => onChange(event.target.value) } : { defaultValue: value })}
        />
      </div>
    </div>
  );
}
`,
  ),

  Select: layout(
    `import { FieldLabel, SelectField } from "@/components/site/ui";

export default function Select({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: string[];
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      {label && <FieldLabel>{label}</FieldLabel>}
      <SelectField
        aria-label={label}
        {...(onChange ? { value: value ?? options[0], onChange: (event) => onChange(event.target.value) } : { defaultValue: value ?? options[0] })}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
`,
  ),

  Switch: layout(
    `"use client";

import { useState } from "react";

export default function Switch({
  label,
  description,
  checked = false,
  onChange,
}: {
  label: string;
  description?: string;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [internal, setInternal] = useState(checked);
  const on = onChange ? checked : internal;
  const setOn = (next: boolean) => {
    setInternal(next);
    onChange?.(next);
  };

  return (
    <label className="flex items-start justify-between gap-4 text-sm">
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {description && <span className="text-muted-foreground">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => setOn(!on)}
        className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")}
      >
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-background shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}
`,
  ),
};
