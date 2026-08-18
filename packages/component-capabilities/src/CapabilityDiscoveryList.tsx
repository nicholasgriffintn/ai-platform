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
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No matching capabilities were found.
      </p>
    );
  }

  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.name}</p>
              {item.description && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{item.description}</p>
              )}
            </div>
            <Badge variant="outline">{item.stateLabel}</Badge>
          </div>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{item.reason}</p>
          {item.state === "setup_required" && renderSetupActions && (
            <div className="mt-3 flex flex-wrap gap-2">{renderSetupActions(item)}</div>
          )}
        </div>
      ))}
    </>
  );
}
