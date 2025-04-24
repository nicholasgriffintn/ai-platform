import type { ReactNode } from "react";
import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { Button } from "~/components/ui/Button";
import { cn } from "~/lib/utils";

interface Action {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: Action[];
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actions,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center h-full",
        className,
      )}
    >
      {icon && <div className="mb-4">{icon}</div>}
      <PageHeader>
        <PageTitle title={title} />
      </PageHeader>
      {description && (
        <p className="text-zinc-500 dark:text-zinc-400 mb-4">{description}</p>
      )}
      {actions && (
        <div className="flex gap-2">
          {actions.map((action, idx) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              variant={action.variant}
              icon={action.icon}
              disabled={action.disabled}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
