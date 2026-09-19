import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";
import { Check } from "lucide-react";

import { SiteIcon } from "../icons.js";
import { Action, Field, HEADING_FONT, Initials, Placeholder, SiteLink } from "../ui.js";

const SECTION = "w-full py-16 sm:py-24";
const CONTAINER = "mx-auto flex w-full max-w-6xl flex-col gap-10 px-6";
const SECTION_HEADLINE = cn("text-3xl font-semibold tracking-tight sm:text-4xl", HEADING_FONT);

const HERO_BACKGROUNDS = {
  default: "bg-background text-foreground",
  muted: "bg-muted/50 text-foreground",
  gradient: "bg-[radial-gradient(ellipse_at_top,var(--accent),transparent_60%)] text-foreground",
  inverted: "site-surface-contrast bg-foreground text-background",
} as const;

export function Hero({
  eyebrow,
  headline,
  description,
  primaryCta,
  secondaryCta,
  layout = "centered",
  image,
  background = "default",
}: SiteComponentProps<"Hero">) {
  const centered = layout === "centered";
  const supportingTone = background === "inverted" ? "opacity-75" : "text-muted-foreground";
  const copy = (
    <div
      className={cn(
        "flex flex-col gap-6",
        centered ? "items-center text-center" : "items-start text-left",
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-flex rounded-full border px-3 py-1 text-xs font-medium tracking-wide uppercase",
            supportingTone,
          )}
        >
          {eyebrow}
        </span>
      )}
      <h1
        className={cn(
          "max-w-3xl text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl lg:text-6xl",
          HEADING_FONT,
        )}
      >
        {headline}
      </h1>
      {description && <p className={cn("max-w-2xl text-lg", supportingTone)}>{description}</p>}
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
    <section className={cn("w-full py-20 sm:py-28", HERO_BACKGROUNDS[background])}>
      <div
        className={cn(
          "mx-auto w-full max-w-6xl px-6",
          layout === "split" && "grid items-center gap-12 lg:grid-cols-2",
        )}
      >
        {copy}
        {layout === "split" && (
          <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
            {image?.src ? (
              <img
                src={image.src}
                alt={image.alt}
                className="h-full min-h-72 w-full object-cover"
              />
            ) : (
              <Placeholder
                label={image?.alt ?? "Product image"}
                className="h-full min-h-72 w-full"
              />
            )}
          </div>
        )}
      </div>
    </section>
  );
}

const FEATURE_COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

export function FeatureGrid({
  eyebrow,
  headline,
  description,
  items,
  columns = 3,
  variant = "cards",
}: SiteComponentProps<"FeatureGrid">) {
  const columnClass =
    FEATURE_COLUMNS[columns as keyof typeof FEATURE_COLUMNS] ?? FEATURE_COLUMNS[3];

  return (
    <section className={SECTION}>
      <div className={cn(CONTAINER, "gap-12")}>
        {(eyebrow || headline || description) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {eyebrow && (
              <span className="text-sm font-medium tracking-wide text-primary uppercase">
                {eyebrow}
              </span>
            )}
            {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
            {description && <p className="text-lg text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className={cn("grid gap-6", columnClass)}>
          {items.map((item) => (
            <div
              key={item.title}
              className={cn(
                "flex flex-col gap-3",
                variant === "cards" &&
                  "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
              )}
            >
              {item.icon && (
                <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <SiteIcon name={item.icon} size="sm" />
                </span>
              )}
              <h3 className={cn("text-lg font-semibold", HEADING_FONT)}>{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Stats({ headline, items }: SiteComponentProps<"Stats">) {
  return (
    <section className="w-full border-y bg-muted/40 py-12 text-foreground">
      <div className={cn(CONTAINER, "gap-8")}>
        {headline && (
          <h2 className={cn("text-2xl font-semibold tracking-tight", HEADING_FONT)}>{headline}</h2>
        )}
        <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.label} className="flex flex-col gap-1">
              <dd className={cn("text-4xl font-semibold tracking-tight", HEADING_FONT)}>
                {item.value}
              </dd>
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export function LogoCloud({ title, logos }: SiteComponentProps<"LogoCloud">) {
  return (
    <section className="w-full py-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-6">
        {title && <p className="text-sm text-muted-foreground">{title}</p>}
        <ul className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
          {logos.map((logo) => (
            <li
              key={logo}
              className={cn(
                "text-lg font-semibold tracking-tight text-muted-foreground/70",
                HEADING_FONT,
              )}
            >
              {logo}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Testimonials({
  headline,
  items,
  layout = "grid",
}: SiteComponentProps<"Testimonials">) {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <div
          className={cn(
            "grid gap-6",
            layout === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl",
          )}
        >
          {items.map((item) => (
            <figure
              key={item.author + item.quote}
              className="flex flex-col justify-between gap-6 rounded-lg border bg-card p-6 text-card-foreground"
            >
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

export function Pricing({ headline, description, tiers }: SiteComponentProps<"Pricing">) {
  return (
    <section className={SECTION}>
      <div className={cn(CONTAINER, "gap-12")}>
        {(headline || description) && (
          <div className="flex max-w-2xl flex-col gap-3">
            {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
            {description && <p className="text-lg text-muted-foreground">{description}</p>}
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-6 rounded-lg border bg-card p-6 text-card-foreground",
                tier.featured && "border-primary shadow-lg ring-1 ring-primary",
              )}
            >
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">{tier.name}</span>
                <span className="flex items-baseline gap-1">
                  <span className={cn("text-4xl font-semibold tracking-tight", HEADING_FONT)}>
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-muted-foreground">{tier.period}</span>
                  )}
                </span>
                {tier.description && (
                  <p className="text-sm text-muted-foreground">{tier.description}</p>
                )}
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Action
                href={tier.cta.href}
                variant={tier.featured ? "primary" : "outline"}
                className="w-full"
              >
                {tier.cta.label}
              </Action>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FAQ({ headline, items }: SiteComponentProps<"FAQ">) {
  return (
    <section className={SECTION}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <div className="divide-y rounded-lg border">
          {items.map((item) => (
            <details key={item.question} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
                {item.question}
                <span
                  aria-hidden="true"
                  className="text-muted-foreground transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="pt-3 text-sm text-muted-foreground">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const CTA_VARIANTS = {
  default: "bg-background text-foreground",
  primary: "site-surface-contrast bg-primary text-primary-foreground",
  muted: "bg-muted/50 text-foreground",
} as const;

export function CTA({
  headline,
  description,
  primaryCta,
  secondaryCta,
  variant = "default",
}: SiteComponentProps<"CTA">) {
  const inverted = variant === "primary";

  return (
    <section className={cn("w-full py-16 sm:py-20", CTA_VARIANTS[variant])}>
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 px-6 text-center">
        <h2 className={SECTION_HEADLINE}>{headline}</h2>
        {description && (
          <p
            className={cn(
              "max-w-2xl text-lg",
              inverted ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {description}
          </p>
        )}
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

export function Steps({ headline, items, direction = "horizontal" }: SiteComponentProps<"Steps">) {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <ol
          className={cn("grid gap-8", direction === "horizontal" ? "md:grid-cols-3" : "max-w-2xl")}
        >
          {items.map((item, index) => (
            <li key={item.title} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {index + 1}
              </span>
              <span className="flex flex-col gap-1">
                <span className={cn("text-lg font-semibold", HEADING_FONT)}>{item.title}</span>
                <span className="text-sm text-muted-foreground">{item.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Team({ headline, members }: SiteComponentProps<"Team">) {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((member) => (
            <li key={member.name} className="flex flex-col gap-3">
              {member.image?.src ? (
                <img
                  src={member.image.src}
                  alt={member.image.alt}
                  className="aspect-square w-full rounded-lg object-cover"
                />
              ) : (
                <span
                  className={cn(
                    "flex aspect-square w-full items-center justify-center rounded-lg bg-muted text-3xl font-semibold text-muted-foreground",
                    HEADING_FONT,
                  )}
                >
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

export function Gallery({ headline, items, columns = 3 }: SiteComponentProps<"Gallery">) {
  const columnClass =
    FEATURE_COLUMNS[columns as keyof typeof FEATURE_COLUMNS] ?? FEATURE_COLUMNS[3];

  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <ul className={cn("grid gap-6", columnClass)}>
          {items.map((item) => (
            <li key={item.alt} className="flex flex-col gap-2">
              {item.src ? (
                <img
                  src={item.src}
                  alt={item.alt}
                  className="aspect-4/3 w-full rounded-lg object-cover"
                />
              ) : (
                <Placeholder label={item.alt} className="aspect-4/3 w-full rounded-lg" />
              )}
              {item.caption && (
                <span className="text-sm text-muted-foreground">{item.caption}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Newsletter({
  headline,
  description,
  placeholder = "you@example.com",
  buttonLabel = "Subscribe",
}: SiteComponentProps<"Newsletter">) {
  return (
    <section className="w-full bg-muted/50 py-16 text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <h2 className={cn("text-3xl font-semibold tracking-tight", HEADING_FONT)}>{headline}</h2>
        {description && <p className="text-muted-foreground">{description}</p>}
        <form
          className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          onSubmit={(event) => event.preventDefault()}
        >
          <Field type="email" placeholder={placeholder} aria-label="Email address" required />
          <Action>{buttonLabel}</Action>
        </form>
      </div>
    </section>
  );
}

export function Articles({ headline, items, layout = "grid" }: SiteComponentProps<"Articles">) {
  return (
    <section className={SECTION}>
      <div className={CONTAINER}>
        {headline && <h2 className={SECTION_HEADLINE}>{headline}</h2>}
        <ul
          className={cn(
            "grid gap-8",
            layout === "grid" ? "md:grid-cols-2 lg:grid-cols-3" : "max-w-3xl",
          )}
        >
          {items.map((item) => (
            <li key={item.title} className="flex flex-col gap-2">
              {item.tag && (
                <span className="text-xs font-medium tracking-wide text-primary uppercase">
                  {item.tag}
                </span>
              )}
              <h3 className={cn("text-xl leading-snug font-semibold", HEADING_FONT)}>
                {item.href ? (
                  <SiteLink href={item.href} className="hover:underline">
                    {item.title}
                  </SiteLink>
                ) : (
                  item.title
                )}
              </h3>
              {item.excerpt && <p className="text-sm text-muted-foreground">{item.excerpt}</p>}
              {(item.date || item.author) && (
                <span className="text-xs text-muted-foreground">
                  {[item.author, item.date].filter(Boolean).join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
