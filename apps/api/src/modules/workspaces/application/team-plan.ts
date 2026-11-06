import { workspacePoolCredits } from "@ngriffin_uk/polychat-ai-billing";
import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  creditMicrosFromCredits,
  usagePeriodFromDate,
  usagePeriodResetsAt,
  type ProvisionWorkspaceTeamPlanInput,
  type WorkspaceTeamPlanResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { WorkspacePoolRepository } from "~/modules/usage/infrastructure/WorkspacePoolRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import { WorkspaceTeamPlanRepository } from "~/modules/workspaces/infrastructure/WorkspaceTeamPlanRepository";

function seatsFullError(): AssistantError {
  return new AssistantError("Every seat in this workspace is taken", ErrorType.CONFLICT_ERROR, 409);
}

async function readTeamPlan(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceTeamPlanResponse> {
  const plans = context.repositories.get(WorkspaceTeamPlanRepository);
  const period = usagePeriodFromDate();
  const [plan, pool, occupied] = await Promise.all([
    plans.getPlan(workspaceId),
    context.repositories.get(WorkspacePoolRepository).getPool(workspaceId, period),
    plans.countOccupiedSeats(workspaceId, { now: new Date().toISOString() }),
  ]);

  if (!plan || !pool) {
    return { teamPlan: null };
  }

  return {
    teamPlan: {
      seats: {
        limit: plan.seat_limit,
        occupied,
        available: Math.max(0, plan.seat_limit - occupied),
      },
      pool: {
        period,
        resetsAt: usagePeriodResetsAt(period),
        credits: workspacePoolCredits(pool),
      },
    },
  };
}

export async function getWorkspaceTeamPlan(context: ServiceContext, workspaceId: string) {
  await requireWorkspaceAccess(context, workspaceId);

  return readTeamPlan(context, workspaceId);
}

export async function provisionWorkspaceTeamPlan(
  context: ServiceContext,
  workspaceId: string,
  input: ProvisionWorkspaceTeamPlanInput,
) {
  const actor = context.requireUser();
  const plans = context.repositories.get(WorkspaceTeamPlanRepository);

  if (!(await context.repositories.get(WorkspaceRepository).getWorkspace(workspaceId))) {
    throw new AssistantError("Workspace not found", ErrorType.NOT_FOUND, 404);
  }

  const occupied = await plans.countOccupiedSeats(workspaceId, { now: new Date().toISOString() });
  const decision = authorise("workspace.plan.provision", {
    role: actor.role ?? "",
    seatLimit: input.seatLimit,
    occupied,
  });

  if (!decision.allowed) {
    throw new AssistantError(
      `This seat limit cannot be set while ${occupied} seats are taken`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  await plans.savePlan({
    workspaceId,
    seatLimit: input.seatLimit,
    includedCreditMicros: creditMicrosFromCredits(input.includedCredits),
    graceCreditMicros: creditMicrosFromCredits(input.graceCredits),
    provisionedBy: actor.id,
  });
  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: actor.id,
    action: "workspace.team_plan.provisioned",
    targetType: "workspace",
    targetId: workspaceId,
    metadata: { seatLimit: input.seatLimit },
  });

  return readTeamPlan(context, workspaceId);
}

export async function endWorkspaceTeamPlan(context: ServiceContext, workspaceId: string) {
  const actor = context.requireUser();

  if (!authorise("workspace.plan.end", { role: actor.role ?? "" }).allowed) {
    throw new AssistantError(
      "Only platform administrators can end a team plan",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const ended = await context.repositories.get(WorkspaceTeamPlanRepository).deletePlan(workspaceId);

  if (!ended) {
    throw new AssistantError("Team plan not found", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: actor.id,
    action: "workspace.team_plan.ended",
    targetType: "workspace",
    targetId: workspaceId,
  });

  return { success: true };
}

export async function assertInvitationSeat(
  context: ServiceContext,
  workspaceId: string,
  email: string,
): Promise<void> {
  const plans = context.repositories.get(WorkspaceTeamPlanRepository);
  const [plan, occupied] = await Promise.all([
    plans.getPlan(workspaceId),
    plans.countOccupiedSeats(workspaceId, {
      now: new Date().toISOString(),
      exceptInvitedEmail: email,
    }),
  ]);

  if (
    !authorise("workspace.seat.claim", {
      seatLimited: Boolean(plan),
      seatLimit: plan?.seat_limit ?? 0,
      occupied,
    }).allowed
  ) {
    throw seatsFullError();
  }
}

export async function assertSeatForAcceptance(
  context: ServiceContext,
  workspaceId: string,
): Promise<void> {
  const plans = context.repositories.get(WorkspaceTeamPlanRepository);
  const [plan, occupied] = await Promise.all([
    plans.getPlan(workspaceId),
    plans.countMembers(workspaceId),
  ]);

  if (
    !authorise("workspace.seat.claim", {
      seatLimited: Boolean(plan),
      seatLimit: plan?.seat_limit ?? 0,
      occupied,
    }).allowed
  ) {
    throw seatsFullError();
  }
}
