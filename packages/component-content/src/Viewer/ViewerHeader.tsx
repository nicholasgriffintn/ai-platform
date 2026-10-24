import { OptionsMenu, cn } from "@ngriffin_uk/polychat-component-ui";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface ViewerHeaderProps {
  title: string;
  titleId?: string;
  icon: ReactNode;
  location?: string;
  detail?: string;
  menu?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function TitleChip({
  title,
  titleId,
  icon,
}: Pick<ViewerHeaderProps, "title" | "titleId" | "icon">) {
  return (
    <>
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <span id={titleId} className="truncate">
        {title}
      </span>
    </>
  );
}

export function ViewerHeader({
  title,
  titleId,
  icon,
  location,
  detail,
  menu,
  actions,
  className,
}: ViewerHeaderProps) {
  const chipClassName =
    "inline-flex h-9 max-w-full min-w-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-foreground";

  return (
    <div className={cn("flex min-h-12 items-center justify-between gap-3", className)}>
      {menu ? (
        <OptionsMenu
          align="start"
          className="w-72"
          trigger={
            <button
              type="button"
              className={cn(
                chipClassName,
                "transition-colors hover:bg-selection focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
              )}
              aria-label={`${title} details`}
            >
              <TitleChip title={title} titleId={titleId} icon={icon} />
              <ChevronDown
                size={14}
                className="shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </button>
          }
        >
          <div className="flex flex-col gap-0.5 px-2.5 pt-1.5 pb-2.5">
            <span className="truncate text-sm font-medium text-foreground">{title}</span>
            {location || detail ? (
              <span className="truncate text-xs text-muted-foreground">
                {[location, detail].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>
          <div className="mb-1 h-px bg-border" />
          {menu}
        </OptionsMenu>
      ) : (
        <span className={chipClassName}>
          <TitleChip title={title} titleId={titleId} icon={icon} />
        </span>
      )}
      {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  );
}
