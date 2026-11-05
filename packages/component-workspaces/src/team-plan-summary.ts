import type { WorkspaceTeamPlan } from "@ngriffin_uk/polychat-schemas";

export interface TeamPlanSummary {
  seatsFull: boolean;
  remainingCredits: number;
  committedRatio: number;
}

export function summariseTeamPlan({ seats, pool }: WorkspaceTeamPlan): TeamPlanSummary {
  const { included, grace, used, reserved } = pool.credits;
  const ceiling = included + grace;
  const committed = used + reserved;

  return {
    seatsFull: seats.available === 0,
    remainingCredits: Math.max(0, ceiling - committed),
    committedRatio: ceiling > 0 ? Math.min(1, committed / ceiling) : 1,
  };
}
