import { Badge, cn, Link } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface ProductRailItem {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: number;
  shortcut?: string;
}

export type ProductRailOrientation = "vertical" | "horizontal";

export interface ProductRailProps {
  items: ProductRailItem[];
  footerItems?: ProductRailItem[];
  orientation?: ProductRailOrientation;
  label?: string;
  className?: string;
  onSelect?: (item: ProductRailItem) => void;
}

function ProductRailControl({
  item,
  onSelect,
}: {
  item: ProductRailItem;
  onSelect?: (item: ProductRailItem) => void;
}) {
  const content = (
    <>
      <span className="polychat-rail-icon" aria-hidden="true">
        {item.icon}
        {item.badge ? (
          <Badge
            variant="warning"
            className="polychat-rail-badge"
            aria-label={`${item.badge} waiting`}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </Badge>
        ) : null}
      </span>
      <span className="polychat-rail-label">{item.label}</span>
    </>
  );
  const title = item.shortcut ? `${item.label} (${item.shortcut})` : item.label;

  if (item.href) {
    return (
      <Link
        href={item.href}
        title={title}
        aria-label={item.label}
        aria-current={item.isActive ? "page" : undefined}
        className="polychat-rail-item no-underline"
        onClick={() => onSelect?.(item)}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={item.label}
      aria-pressed={item.isActive || undefined}
      className="polychat-rail-item"
      onClick={() => {
        item.onClick?.();
        onSelect?.(item);
      }}
    >
      {content}
    </button>
  );
}

export function ProductRail({
  items,
  footerItems = [],
  orientation = "vertical",
  label = "Places",
  className,
  onSelect,
}: ProductRailProps) {
  return (
    <nav
      aria-label={label}
      data-orientation={orientation}
      className={cn("polychat-rail", className)}
    >
      <ul className="polychat-rail-group">
        {items.map((item) => (
          <li key={item.id}>
            <ProductRailControl item={item} onSelect={onSelect} />
          </li>
        ))}
      </ul>
      {footerItems.length > 0 ? (
        <ul className="polychat-rail-group polychat-rail-group-footer">
          {footerItems.map((item) => (
            <li key={item.id}>
              <ProductRailControl item={item} onSelect={onSelect} />
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
