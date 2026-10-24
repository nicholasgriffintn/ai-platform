import { Button, cn } from "@ngriffin_uk/polychat-component-ui";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { ReactNode } from "react";

export function NotebookPanel({
  title,
  side,
  collapsed = false,
  onToggle,
  actions,
  className,
  children,
}: {
  title: string;
  side: "left" | "centre" | "right";
  collapsed?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const CollapseIcon = side === "left" ? PanelLeftClose : PanelRightClose;
  const ExpandIcon = side === "left" ? PanelLeftOpen : PanelRightOpen;

  if (collapsed && onToggle) {
    return (
      <section
        aria-label={title}
        className={cn(
          "flex min-h-0 flex-col items-center gap-2 rounded-2xl border border-border bg-surface py-2",
          className,
        )}
      >
        <Button
          variant="icon"
          aria-label={`Show ${title.toLowerCase()}`}
          title={`Show ${title.toLowerCase()}`}
          onClick={onToggle}
        >
          <ExpandIcon className="size-4" />
        </Button>
        <span className="text-xs font-medium text-muted-foreground [writing-mode:vertical-rl]">
          {title}
        </span>
      </section>
    );
  }

  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface",
        className,
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{title}</h2>
        {actions}
        {onToggle ? (
          <Button
            variant="icon"
            aria-label={`Hide ${title.toLowerCase()}`}
            title={`Hide ${title.toLowerCase()}`}
            onClick={onToggle}
          >
            <CollapseIcon className="size-4" />
          </Button>
        ) : null}
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
