import { BackLink, cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import { Settings2, Workflow } from "lucide-react";

export type TeammatePageSection = "configuration" | "context";

export function getTeammatePagePaths(teammatesPath: string, teammateId: string) {
  const teammatePath = `${teammatesPath.replace(/\/+$/u, "")}/${encodeURIComponent(teammateId)}`;

  return {
    editorPath: teammatePath,
    contextPath: `${teammatePath}/context`,
  };
}

export function TeammatePageHeader({
  backPath,
  backLabel,
  teammateName,
  teammatePath,
  contextPath,
  activeSection,
  description,
}: {
  backPath: string;
  backLabel: string;
  teammateName: string;
  teammatePath: string;
  contextPath?: string;
  activeSection: TeammatePageSection;
  description: string;
}) {
  return (
    <header className="mb-8 space-y-5">
      <BackLink href={backPath} label={backLabel} />
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">{teammateName}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <nav aria-label="Teammate sections" className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          <NavLink
            href={teammatePath}
            end
            aria-current={activeSection === "configuration" ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium no-underline transition-colors hover:!no-underline",
              activeSection === "configuration"
                ? "border-active-work text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Settings2 className="size-4" />
            Configuration
          </NavLink>
          {contextPath ? (
            <NavLink
              href={contextPath}
              aria-current={activeSection === "context" ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium no-underline transition-colors hover:!no-underline",
                activeSection === "context"
                  ? "border-active-work text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Workflow className="size-4" />
              Working context
            </NavLink>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
