import { Link } from "@ngriffin_uk/polychat-component-ui";
import { BriefcaseBusiness, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";

export type ProductMode = "chat" | "work";

export interface ProductModeDestination {
  href: string;
  icon: ReactNode;
  label: string;
  mode: ProductMode;
}

export interface ProductModeSwitchProps {
  activeMode: ProductMode;
  className?: string;
  /** Resolved host routes for each mode, keyed by mode. */
  destinations: Record<ProductMode, string>;
}

export function ProductModeSwitch({ activeMode, className, destinations }: ProductModeSwitchProps) {
  const modes: ProductModeDestination[] = [
    {
      href: destinations.chat,
      icon: <MessageCircle size={15} aria-hidden="true" />,
      label: "Chat",
      mode: "chat",
    },
    {
      href: destinations.work,
      icon: <BriefcaseBusiness size={15} aria-hidden="true" />,
      label: "Work",
      mode: "work",
    },
  ];

  return (
    <div
      className={["polychat-navigation-mode-switch", className].filter(Boolean).join(" ")}
      role="group"
      aria-label="Product mode"
    >
      {modes.map(({ href, icon, label, mode }) => (
        <Link
          key={mode}
          href={href}
          aria-label={label}
          aria-current={activeMode === mode ? "page" : undefined}
          className="polychat-navigation-mode-control no-underline"
        >
          {icon}
          <span className="polychat-navigation-mode-label">{label}</span>
        </Link>
      ))}
    </div>
  );
}
