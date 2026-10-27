import { authorise } from "@ngriffin_uk/polychat-library-policy";
import {
  creditsFromCreditMicros,
  usagePeriodFromDate,
  WORK_BUDGET_WARNING_RATIO,
} from "@ngriffin_uk/polychat-schemas";
import { formatCredits } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { managesTeammate, readTeammateSpendByWorkspace } from "./organisation";

export interface BudgetAlert {
  workspaceId: string;
  teammateId: string;
  managerId: string;
  projectId: string;
  kind: "warning" | "paused";
  usedMicros: number;
  capMicros: number;
}

function isBudgetPaused(record: WorkspaceTeammateRecord): boolean {
  return record.status === "paused" && record.pausedReason === "budget";
}

function budgetAlert(
  record: WorkspaceTeammateRecord,
  kind: BudgetAlert["kind"],
  usedMicros: number,
  capMicros: number,
): BudgetAlert[] {
  const projectId = record.projectIds[0];

  return record.reportsToTeammateId && projectId
    ? [
        {
          workspaceId: record.workspaceId,
          teammateId: record.teammateId,
          managerId: record.reportsToTeammateId,
          projectId,
          kind,
          usedMicros,
          capMicros,
        },
      ]
    : [];
}

export async function readWorkspaceSpend(
  context: ServiceContext,
  workspaceId: string,
): Promise<number> {
  const rows = await context.repositories.get(UsageEventRepository).summariseWorkspaceSpend({
    workspaceId,
    period: usagePeriodFromDate(),
    groupBy: "project",
  });

  return rows.reduce((sum, row) => sum + Math.max(0, Math.round(row.credit_micros)), 0);
}

export async function reviewWorkBudgets(
  context: ServiceContext,
  employments: readonly WorkspaceTeammateRecord[],
): Promise<{ employments: WorkspaceTeammateRecord[]; alerts: BudgetAlert[] }> {
  const period = usagePeriodFromDate();
  const repository = context.repositories.get(WorkspaceTeammateRepository);
  const capped = employments.filter(
    (record) =>
      record.monthlyCreditCapMicros && (record.status === "active" || isBudgetPaused(record)),
  );
  const changed = new Map<string, WorkspaceTeammateRecord>();
  const alerts: BudgetAlert[] = [];

  for (const workspaceId of new Set(capped.map((record) => record.workspaceId))) {
    const spend = await readTeammateSpendByWorkspace(context, workspaceId);

    for (const record of capped.filter((candidate) => candidate.workspaceId === workspaceId)) {
      const cap = record.monthlyCreditCapMicros ?? 0;
      const used = spend.get(record.teammateId) ?? 0;
      const now = new Date().toISOString();
      let updated: WorkspaceTeammateRecord | null = null;

      if (isBudgetPaused(record) && used < cap) {
        updated = await repository.update(workspaceId, record.teammateId, {
          status: "active",
          pausedReason: null,
          budgetAlertAt: null,
        });
      } else if (isBudgetPaused(record) && !record.budgetAlertAt) {
        updated = await repository.update(workspaceId, record.teammateId, { budgetAlertAt: now });
        alerts.push(...budgetAlert(record, "paused", used, cap));
      } else if (record.status === "active" && used >= cap) {
        updated = await repository.update(workspaceId, record.teammateId, {
          status: "paused",
          pausedReason: "budget",
          budgetAlertAt: now,
        });
        alerts.push(...budgetAlert(record, "paused", used, cap));
      } else if (
        record.status === "active" &&
        used >= cap * WORK_BUDGET_WARNING_RATIO &&
        record.budgetWarnedPeriod !== period
      ) {
        updated = await repository.update(workspaceId, record.teammateId, {
          budgetWarnedPeriod: period,
          budgetAlertAt: now,
        });
        alerts.push(...budgetAlert(record, "warning", used, cap));
      }

      if (updated) {
        changed.set(`${workspaceId}:${record.teammateId}`, updated);
      }
    }
  }

  return {
    employments: employments.map(
      (record) => changed.get(`${record.workspaceId}:${record.teammateId}`) ?? record,
    ),
    alerts,
  };
}

function describeBudgetRefusal(params: {
  manager: boolean;
  capped: boolean;
  headroomMicros: number;
}): string {
  if (!params.manager) {
    return "Only this teammate's manager can change its budget. Escalate it to them instead.";
  }

  if (!params.capped) {
    return "The workspace has no monthly budget, so only a person can give a teammate more. Escalate it with your reasoning.";
  }

  return `The workspace has ${formatCredits(creditsFromCreditMicros(Math.max(0, params.headroomMicros)))} credits left this month, which does not cover that raise. Raise it by less, or escalate so a person can raise the workspace budget.`;
}

export async function setReportBudget(
  context: ServiceContext,
  params: {
    workspaceId: string;
    managerId: string;
    teammateId: string;
    monthlyCreditCapMicros: number;
    reason: string;
  },
): Promise<WorkspaceTeammateRecord> {
  const user = context.requireUser();
  const repository = context.repositories.get(WorkspaceTeammateRepository);
  const record = await repository.get(params.workspaceId, params.teammateId);

  if (!record || (record.status !== "active" && record.status !== "paused")) {
    throw new AssistantError("That teammate is not on this team", ErrorType.NOT_FOUND, 404);
  }

  const [manager, workspace, teamSpend, workspaceSpend] = await Promise.all([
    managesTeammate(context, params.workspaceId, params.managerId, params.teammateId),
    context.repositories.get(WorkspaceRepository).getWorkspace(params.workspaceId),
    readTeammateSpendByWorkspace(context, params.workspaceId),
    readWorkspaceSpend(context, params.workspaceId),
  ]);
  const current = record.monthlyCreditCapMicros;
  const raising = current !== null && params.monthlyCreditCapMicros > current;
  const workspaceCap = workspace?.monthly_credit_cap_micros ?? null;
  const headroomMicros = workspaceCap === null ? 0 : workspaceCap - workspaceSpend;
  const facts = {
    manager,
    raising,
    capped: workspaceCap !== null,
    withinHeadroom: raising ? params.monthlyCreditCapMicros - current <= headroomMicros : true,
  };

  if (!authorise("teammate.budget", facts).allowed) {
    throw new AssistantError(
      describeBudgetRefusal({ ...facts, headroomMicros }),
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const used = teamSpend.get(params.teammateId) ?? 0;
  const updated = await repository.update(params.workspaceId, params.teammateId, {
    monthlyCreditCapMicros: params.monthlyCreditCapMicros,
    budgetWarnedPeriod: null,
    budgetAlertAt: null,
    ...(isBudgetPaused(record) && used < params.monthlyCreditCapMicros
      ? { status: "active" as const, pausedReason: null }
      : {}),
  });

  if (!updated) {
    throw new AssistantError("That teammate is not on this team", ErrorType.NOT_FOUND, 404);
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId: params.workspaceId,
    actorUserId: user.id,
    action: "workspace.teammate.budget_changed",
    targetType: "teammate",
    targetId: params.teammateId,
    metadata: {
      byTeammateId: params.managerId,
      fromCreditMicros: current,
      toCreditMicros: params.monthlyCreditCapMicros,
      reason: params.reason,
    },
  });

  return updated;
}
