import { BackLink, cn, NavLink } from "@ngriffin_uk/polychat-component-ui";
import { MessagesSquare, Settings2, Workflow, type LucideIcon } from "lucide-react";

import { PageShell } from "../Shell/PageShell.js";

export type TeammatePageSection = "conversation" | "configuration" | "context";

export function getTeammatePagePaths(teammatesPath: string, teammateId: string) {
  const teammatePath = `${teammatesPath.replace(/\/+$/u, "")}/${encodeURIComponent(teammateId)}`;

  return {
    homePath: teammatePath,
    settingsPath: `${teammatePath}/settings`,
    contextPath: `${teammatePath}/context`,
  };
}

const SECTIONS: readonly { id: TeammatePageSection; label: string; icon: LucideIcon }[] = [
  { id: "conversation", label: "Conversation", icon: MessagesSquare },
  { id: "configuration", label: "Configuration", icon: Settings2 },
  { id: "context", label: "Working context", icon: Workflow },
];

export function TeammatePageHeader({
  backPath,
  backLabel,
  teammateName,
  paths,
  activeSection,
  description,
}: {
  backPath: string;
  backLabel: string;
  teammateName: string;
  paths: Partial<Record<"homePath" | "settingsPath" | "contextPath", string>>;
  activeSection: TeammatePageSection;
  description: string;
}) {
  const hrefs: Record<TeammatePageSection, string | undefined> = {
    conversation: paths.homePath,
    configuration: paths.settingsPath,
    context: paths.contextPath,
  };

  return (
    <header className="mb-6">
      <PageShell.Header title={teammateName} />
      <BackLink href={backPath} label={backLabel} />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{description}</p>
      <nav aria-label="Teammate sections" className="border-b border-border">
        <div className="flex flex-wrap gap-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const href = hrefs[id];

            return href ? (
              <NavLink
                key={id}
                href={href}
                end
                aria-current={activeSection === id ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium no-underline transition-colors hover:!no-underline",
                  activeSection === id
                    ? "border-active-work text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ) : null;
          })}
        </div>
      </nav>
    </header>
  );
}
