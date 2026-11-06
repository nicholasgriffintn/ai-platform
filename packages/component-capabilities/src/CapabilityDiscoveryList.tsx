import { Button } from "@ngriffin_uk/polychat-component-ui";
import { useState, type ReactNode } from "react";

const COLLAPSED_ITEM_COUNT = 3;

export interface CapabilityDiscoveryItem {
  id: string;
  name: string;
  description?: string;
  icon?: ReactNode;
}

export interface CapabilityDiscoveryListProps {
  items: CapabilityDiscoveryItem[];
  renderSetupActions?: (item: CapabilityDiscoveryItem) => ReactNode;
}

export function CapabilityDiscoveryList({
  items,
  renderSetupActions,
}: CapabilityDiscoveryListProps) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching capabilities were found.</p>;
  }

  const visibleItems = expanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="rounded-lg border border-border">
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-foreground">Setup needed</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {items.length === 1
            ? "Set this up, then ask again."
            : "Set up any one of these, then ask again."}
        </p>
      </div>
      <ul className="divide-y divide-border border-t border-border">
        {visibleItems.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-3 py-2">
            {item.icon}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground">{item.name}</p>
              {item.description && (
                <p className="truncate text-xs text-muted-foreground" title={item.description}>
                  {item.description}
                </p>
              )}
            </div>
            {renderSetupActions && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                {renderSetupActions(item)}
              </div>
            )}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <div className="border-t border-border p-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="w-full"
            onClick={() => setExpanded(true)}
          >
            Show {hiddenCount} more
          </Button>
        </div>
      )}
    </div>
  );
}
