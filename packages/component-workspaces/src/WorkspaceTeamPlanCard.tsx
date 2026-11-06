import { Card, cn } from "@ngriffin_uk/polychat-component-ui";
import { WORK_BUDGET_WARNING_RATIO, type WorkspaceTeamPlan } from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";

import { summariseTeamPlan } from "./team-plan-summary";

export interface WorkspaceTeamPlanCardProps {
  teamPlan: WorkspaceTeamPlan;
  canManage: boolean;
}

function seatsHint(seatsFull: boolean, canManage: boolean, available: number): string {
  if (!seatsFull) {
    return `${available} open. Pending invitations hold a seat.`;
  }

  return canManage
    ? "Every seat is taken. Revoke an invitation or remove someone to invite another person."
    : "Every seat is taken.";
}

export function WorkspaceTeamPlanCard({ teamPlan, canManage }: WorkspaceTeamPlanCardProps) {
  const { seats, pool } = teamPlan;
  const { seatsFull, remainingCredits, committedRatio } = summariseTeamPlan(teamPlan);

  return (
    <Card className="mb-6 grid gap-6 px-5 py-4 shadow-none sm:grid-cols-2">
      <section aria-label="Seats" className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold">Seats</h2>
        <p className="text-sm">
          {seats.occupied} of {seats.limit} used
        </p>
        <p className="text-xs text-muted-foreground">
          {seatsHint(seatsFull, canManage, seats.available)}
        </p>
      </section>
      <section aria-label="Shared credits" className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold">Shared credits</h2>
        <p className="text-sm">About {formatCredits(remainingCredits)} left this period</p>
        <div className="h-1.5 overflow-hidden rounded-full bg-border">
          <span
            className={cn(
              "block h-full",
              committedRatio >= 1
                ? "bg-failure"
                : committedRatio >= WORK_BUDGET_WARNING_RATIO
                  ? "bg-attention"
                  : "bg-success",
            )}
            style={{ width: `${committedRatio * 100}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Work in this workspace draws on this pool. Resets{" "}
          {new Date(pool.resetsAt).toLocaleDateString()}.
        </p>
      </section>
    </Card>
  );
}
