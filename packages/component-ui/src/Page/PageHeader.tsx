import type { ReactNode } from "react";

import { Button } from "../Button";

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  isLoading?: boolean;
}

export function PageHeaderActions({ actions }: { actions: PageHeaderAction[] }) {
  return (
    <div className="flex shrink-0 items-center gap-1 sm:gap-2">
      {actions.map((action, index) => (
        <Button
          key={`${action.label}-${index}`}
          onClick={action.onClick}
          variant={action.variant || "primary"}
          size="sm"
          collapseLabel
          className="shrink-0"
          icon={action.isLoading ? undefined : action.icon}
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          isLoading={action.isLoading}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}

export function PageHeader({
  children,
  actions,
}: {
  children: ReactNode;
  actions?: PageHeaderAction[];
}) {
  return (
    <div className="mb-6 flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">{children}</div>
      {actions && <PageHeaderActions actions={actions} />}
    </div>
  );
}
