import { NavLink, WorkbenchCard, WorkbenchFact } from "@ngriffin_uk/polychat-component-ui";
import {
  TEAMMATE_AUTONOMY_COPY,
  useRecipeInstallations,
  useTeammateComputer,
  useTeammateConnectionGrants,
  useTeammateContextSpend,
  useTeammatePresence,
} from "@ngriffin_uk/polychat-library-react";
import type { TeammateContext } from "@ngriffin_uk/polychat-schemas";
import { formatClockTime } from "@ngriffin_uk/polychat-utility-core";
import {
  Activity,
  CalendarClock,
  Coins,
  Monitor,
  PauseCircle,
  Plug,
  ShieldCheck,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { describeSpend, spendStateCopy } from "./SpendCapControl.js";

const RAIL_LINK_CLASS =
  "block rounded-md no-underline transition-colors hover:bg-selection hover:!no-underline";

function countLabel(count: number, one: string, many: string): string {
  return count === 0 ? `No ${many}` : `${count} ${count === 1 ? one : many}`;
}

function LinkedFact({
  href,
  icon,
  label,
  title,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  title?: string;
}) {
  return (
    <NavLink href={href} className={RAIL_LINK_CLASS}>
      <WorkbenchFact icon={icon} label={label} title={title} />
    </NavLink>
  );
}

function statusFact(context: TeammateContext, presenceStatus: string, isBusy: boolean) {
  if (context.status === "archived") {
    return "Archived";
  }

  if (context.status === "paused") {
    return context.pausedUntil ? `Paused until ${formatClockTime(context.pausedUntil)}` : "Paused";
  }

  return isBusy ? presenceStatus : null;
}

export function TeammateRailCard({
  teammateId,
  context,
  projectId,
  settingsPath,
  contextPath,
}: {
  teammateId: string;
  context: TeammateContext;
  projectId?: string;
  settingsPath: string;
  contextPath: string;
}) {
  const presence = useTeammatePresence(teammateId);
  const installations = useRecipeInstallations(projectId);
  const { grants } = useTeammateConnectionGrants(context.id);
  const { data: computer } = useTeammateComputer(context.id);
  const spend = useTeammateContextSpend(context.id);
  const routines = (installations.data?.installations ?? []).filter(
    (installation) => installation.teammateContextId === context.id,
  );
  const status = statusFact(context, presence.status, presence.state !== "idle");

  return (
    <WorkbenchCard
      title="Teammate"
      icon={UsersRound}
      aside={
        <NavLink
          href={settingsPath}
          className="text-xs text-muted-foreground no-underline hover:text-foreground hover:!no-underline"
        >
          Configure
        </NavLink>
      }
    >
      <div className="space-y-0.5">
        {status ? (
          <WorkbenchFact
            icon={context.status === "active" ? Activity : PauseCircle}
            label={status}
          />
        ) : null}
        {context.autonomyLevel ? (
          <WorkbenchFact
            icon={ShieldCheck}
            label={TEAMMATE_AUTONOMY_COPY[context.autonomyLevel].label}
            title={TEAMMATE_AUTONOMY_COPY[context.autonomyLevel].description}
          />
        ) : null}
        <LinkedFact
          href={`${contextPath}#routines`}
          icon={CalendarClock}
          label={countLabel(routines.length, "routine", "routines")}
        />
        <LinkedFact
          href={`${contextPath}#connections`}
          icon={Plug}
          label={countLabel(grants.length, "connection", "connections")}
        />
        {spend.data ? (
          <LinkedFact
            href={`${contextPath}#spend`}
            icon={Coins}
            label={describeSpend(spend.data)}
            title={spendStateCopy(spend.data) ?? undefined}
          />
        ) : null}
        <LinkedFact
          href={`${contextPath}#computer`}
          icon={Monitor}
          label={computer && computer.status !== "destroyed" ? "Has a computer" : "No computer"}
        />
      </div>
    </WorkbenchCard>
  );
}
