import { SITE_ICON_NAMES } from "../catalog.js";

const ICON_IMPORTS: Record<(typeof SITE_ICON_NAMES)[number], string> = {
  alert: "TriangleAlert",
  "arrow-right": "ArrowRight",
  bell: "Bell",
  bolt: "Zap",
  box: "Box",
  calendar: "Calendar",
  chart: "BarChart3",
  check: "Check",
  clock: "Clock",
  cloud: "Cloud",
  code: "Code2",
  cpu: "Cpu",
  "credit-card": "CreditCard",
  database: "Database",
  download: "Download",
  file: "FileText",
  gift: "Gift",
  globe: "Globe",
  heart: "Heart",
  help: "CircleHelp",
  home: "Home",
  image: "Image",
  info: "Info",
  layers: "Layers",
  link: "Link2",
  lock: "Lock",
  mail: "Mail",
  "map-pin": "MapPin",
  menu: "Menu",
  message: "MessageSquare",
  phone: "Phone",
  play: "Play",
  plus: "Plus",
  rocket: "Rocket",
  search: "Search",
  settings: "Settings",
  shield: "Shield",
  sparkles: "Sparkles",
  star: "Star",
  "trending-down": "TrendingDown",
  "trending-up": "TrendingUp",
  upload: "Upload",
  users: "Users",
  zap: "Zap",
};

export function renderIconModule(): string {
  const unique = [...new Set(Object.values(ICON_IMPORTS))].sort();
  const entries = SITE_ICON_NAMES.map(
    (name) => `  ${JSON.stringify(name)}: ${ICON_IMPORTS[name]},`,
  );

  return `import { ${unique.join(", ")}, type LucideIcon } from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
${entries.join("\n")}
};

export type IconName = keyof typeof ICONS;

const SIZES = { sm: 16, md: 20, lg: 28 } as const;

export function Icon({
  name,
  size = "md",
  className,
}: {
  name?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Component = name ? ICONS[name] : undefined;

  if (!Component) {
    return null;
  }

  return <Component size={SIZES[size]} className={className} aria-hidden="true" />;
}
`;
}

export function renderUtilsModule(): string {
  return `import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
`;
}

export function renderUiModule(): string {
  return `import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

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

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
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
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} onClick={onPress}>
      {children}
    </button>
  );
}

export function Surface({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-lg border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}

export function Field({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        "flex min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}

export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium leading-none", className)} {...props} />;
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
    .split(/\\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return <span aria-hidden="true">{initials || "?"}</span>;
}
`;
}
