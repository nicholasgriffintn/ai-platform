import { Badge } from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export interface CapabilityDiscoveryItem {
  id: string;
  name: string;
  description?: string;
  reason: string;
  state: string;
  stateLabel: string;
}

export interface CapabilityDiscoveryListProps {
  items: CapabilityDiscoveryItem[];
  renderSetupActions?: (item: CapabilityDiscoveryItem) => ReactNode;
}

export function CapabilityDiscoveryList({
  items,
  renderSetupActions,
}: CapabilityDiscoveryListProps) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching capabilities were found.</p>;
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-border p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              {item.description && (
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              )}
            </div>
            <Badge variant="outline">{item.stateLabel}</Badge>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
          {item.state === "setup_required" && renderSetupActions && (
            <div className="mt-3 flex flex-wrap gap-2">{renderSetupActions(item)}</div>
          )}
        </div>
      ))}
    </>
  );
}
