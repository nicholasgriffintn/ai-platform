import { cn } from "@ngriffin_uk/polychat-component-ui";
import type { SiteComponentProps } from "@ngriffin_uk/polychat-library-sites";
import { Check } from "lucide-react";

import { SiteIcon } from "../icons.js";
import { Action, HEADING_FONT, Initials, Placeholder, SiteLink } from "../ui.js";

const HEADING_SIZES = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-3xl sm:text-4xl",
  xl: "text-4xl sm:text-5xl",
  display: "text-5xl sm:text-6xl",
} as const;
const ALIGN = { start: "text-left", center: "text-center", end: "text-right" } as const;

export function Heading({ text, level = 2, size = "md", align }: SiteComponentProps<"Heading">) {
  const Tag = `h${Math.min(4, Math.max(1, level))}` as "h1" | "h2" | "h3" | "h4";

  return (
    <Tag
      className={cn(
        "font-semibold tracking-tight",
        HEADING_FONT,
        HEADING_SIZES[size],
        align && ALIGN[align],
      )}
    >
      {text}
    </Tag>
  );
}

const TEXT_SIZES = { xs: "text-xs", sm: "text-sm", md: "text-base", lg: "text-lg" } as const;
const TEXT_TONES = {
  default: "",
  muted: "opacity-70",
  primary: "text-primary",
} as const;
const TEXT_WEIGHTS = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
} as const;

export function Text({
  text,
  size = "md",
  tone = "default",
  weight = "normal",
  align,
}: SiteComponentProps<"Text">) {
  return (
    <p
      className={cn(
        "leading-relaxed",
        TEXT_SIZES[size],
        TEXT_TONES[tone],
        TEXT_WEIGHTS[weight],
        align && ALIGN[align],
      )}
    >
      {text}
    </p>
  );
}

const BADGE_VARIANTS = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border",
  success: "border border-emerald-500/40 bg-emerald-500/15",
  warning: "border border-amber-500/40 bg-amber-500/15",
  danger: "border border-destructive/40 bg-destructive/15",
} as const;

export function Badge({ text, variant = "default" }: SiteComponentProps<"Badge">) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_VARIANTS[variant],
      )}
    >
      {text}
    </span>
  );
}

export function Button({
  label,
  href,
  variant = "primary",
  size = "md",
  icon,
  fullWidth,
  onPress,
}: SiteComponentProps<"Button"> & { onPress?: () => void }) {
  return (
    <Action
      href={href}
      variant={variant}
      size={size}
      className={cn(fullWidth && "w-full")}
      onPress={onPress}
    >
      <SiteIcon name={icon} size="sm" />
      {label}
    </Action>
  );
}

export function Link({ label, href, icon }: SiteComponentProps<"Link">) {
  return (
    <SiteLink
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium underline decoration-primary/60 underline-offset-4 hover:decoration-primary"
    >
      {label}
      <SiteIcon name={icon} size="sm" />
    </SiteLink>
  );
}

const ASPECTS = {
  square: "aspect-square",
  video: "aspect-video",
  portrait: "aspect-3/4",
  wide: "aspect-21/9",
  auto: "",
} as const;

export function Image({ src, alt, aspect = "video", rounded = true }: SiteComponentProps<"Image">) {
  const classes = cn("w-full object-cover", ASPECTS[aspect], rounded && "rounded-lg");

  return src ? (
    <img src={src} alt={alt} className={classes} />
  ) : (
    <Placeholder label={alt} className={cn(classes, !ASPECTS[aspect] && "aspect-video")} />
  );
}

export function Icon({ name, size = "md", tone = "default" }: SiteComponentProps<"Icon">) {
  return (
    <span className={cn("inline-flex", TEXT_TONES[tone])}>
      <SiteIcon name={name} size={size} />
    </span>
  );
}

const AVATAR_SIZES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-base",
} as const;

export function Avatar({ name, src, size = "md" }: SiteComponentProps<"Avatar">) {
  return src ? (
    <img src={src} alt={name} className={cn("rounded-full object-cover", AVATAR_SIZES[size])} />
  ) : (
    <span
      className={cn(
        "flex items-center justify-center rounded-full bg-muted font-medium",
        "text-muted-foreground",
        AVATAR_SIZES[size],
      )}
      title={name}
    >
      <Initials name={name} />
    </span>
  );
}

export function List({ items, style = "bullet" }: SiteComponentProps<"List">) {
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
          {style === "check" && (
            <Check size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          )}
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Quote({ text, author, role }: SiteComponentProps<"Quote">) {
  return (
    <figure className="flex flex-col gap-4 border-l-2 border-primary pl-6">
      <blockquote className={cn("text-xl leading-relaxed", HEADING_FONT)}>“{text}”</blockquote>
      {author && (
        <figcaption className="text-sm opacity-70">
          {author}
          {role ? `, ${role}` : ""}
        </figcaption>
      )}
    </figure>
  );
}

export function Code({ code, language, title }: SiteComponentProps<"Code">) {
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

const ALERT_VARIANTS = {
  info: { classes: "border-border bg-muted/40", icon: "info" },
  success: { classes: "border-emerald-500/40 bg-emerald-500/10", icon: "check" },
  warning: { classes: "border-amber-500/40 bg-amber-500/10", icon: "alert" },
  danger: { classes: "border-destructive/40 bg-destructive/10", icon: "alert" },
} as const;

export function Alert({ title, description, variant = "info" }: SiteComponentProps<"Alert">) {
  return (
    <div
      role="status"
      className={cn("flex gap-3 rounded-lg border p-4", ALERT_VARIANTS[variant].classes)}
    >
      <SiteIcon name={ALERT_VARIANTS[variant].icon} size="sm" className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium">{title}</span>
        {description && <span className="text-sm opacity-70">{description}</span>}
      </div>
    </div>
  );
}
