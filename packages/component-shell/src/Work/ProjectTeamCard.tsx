import { Badge, Link } from "@ngriffin_uk/polychat-component-ui";
import { initialsOf } from "@ngriffin_uk/polychat-utility-core";
import { UsersRound } from "lucide-react";

import { AskLeadButton } from "./AskLeadButton.js";
import { SettingsSection } from "./SettingsSection.js";
import { useWorkDirectory } from "./useWorkDirectory.js";

export function ProjectTeamCard({
  workspaceId,
  projectId,
  projectName,
}: {
  workspaceId: string;
  projectId: string;
  projectName: string;
}) {
  const { team, leadTeammateId } = useWorkDirectory(workspaceId);
  const members = team.filter(
    (teammate) => teammate.projectIds.includes(projectId) && teammate.status !== "archived",
  );

  return (
    <SettingsSection
      id="team"
      icon={<UsersRound size={16} />}
      title="Team"
      description="Teammates working on this project. The lead hires and reshapes the team; you approve hires in Inbox."
      action={
        <AskLeadButton
          workspaceId={workspaceId}
          projectId={projectId}
          leadTeammateId={leadTeammateId}
          label="Ask the lead to staff this"
          title="Staff this project"
          question="What do you need someone to do?"
          placeholder="Someone to keep the supplier price list current and flag rises"
          objective={(request) => `Staff ${projectName}: ${request}`.slice(0, 200)}
          brief="Use a teammate already on the team if one fits, and give them this project. Otherwise propose a hire with propose_hire, with a title, job description and budget. The hire waits for a person to approve it."
        />
      }
    >
      {members.length ? (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {members.map((member) => (
            <li key={member.teammateId}>
              <Link
                href={`/work/${workspaceId}/team/${member.teammateId}`}
                className="flex items-center gap-3 px-3 py-2.5 text-sm no-underline hover:bg-selection/50 hover:!no-underline"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-active-work/15 text-[11px] font-semibold text-active-work">
                  {initialsOf(member.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-foreground">{member.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.title}
                  </span>
                </span>
                {member.teammateId === leadTeammateId ? <Badge variant="info">Lead</Badge> : null}
                {member.status === "paused" ? <Badge variant="warning">Paused</Badge> : null}
                {member.status === "proposed" ? <Badge variant="muted">Proposed</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nobody is assigned yet. Tasks here run with whoever owns them.
        </p>
      )}
    </SettingsSection>
  );
}
