import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  createContext,
  useContext,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface SiteNavigation {
  navigate: (path: string) => void;
}

const SiteNavigationContext = createContext<SiteNavigation | null>(null);

export const SiteNavigationProvider = SiteNavigationContext.Provider;

export function useSiteNavigation(): SiteNavigation | null {
  return useContext(SiteNavigationContext);
}

export function SiteLink({
  href,
  className,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { href: string }) {
  const navigation = useSiteNavigation();
  const external = /^(https?:|mailto:|tel:)/.test(href);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    props.onClick?.(event);

    if (event.defaultPrevented || external) {
      return;
    }

    event.preventDefault();

    if (href.startsWith("#")) {
      event.currentTarget
        .closest("[data-site-preview]")
        ?.querySelector(`[id="${href.slice(1)}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });

      return;
    }

    navigation?.navigate(href);
  };

  return (
    <a
      {...props}
      href={href}
      className={className}
      onClick={handleClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

export const BUTTON_VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  link: "text-primary underline-offset-4 hover:underline px-0",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
} as const;

export const BUTTON_SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
} as const;

export type ButtonVariant = keyof typeof BUTTON_VARIANTS;
export type ButtonSize = keyof typeof BUTTON_SIZES;

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    extra,
  );
}

export function Action({
  href,
  variant,
  size,
  className,
  children,
  onPress,
  type = "button",
}: {
  href?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  onPress?: () => void;
  type?: "button" | "submit";
}) {
  const classes = buttonClass(variant, size, className);

  if (href && !onPress) {
    return (
      <SiteLink href={href} className={classes}>
        {children}
      </SiteLink>
    );
  }

  return (
    <button type={type} className={classes} onClick={onPress}>
      {children}
    </button>
  );
}

export function Field({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function TextField({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function SelectField({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm leading-none font-medium", className)} {...props} />;
}

export function Placeholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex items-center justify-center bg-[linear-gradient(135deg,var(--muted),var(--accent))] text-xs text-muted-foreground",
        className,
      )}
    >
      <span className="max-w-[80%] truncate px-3 text-center">{label}</span>
    </div>
  );
}

export function Initials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return <span aria-hidden="true">{initials || "?"}</span>;
}

export const HEADING_FONT = "font-(family-name:--font-heading)";
