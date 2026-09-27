import { hostManifest } from "@ngriffin_uk/polychat-ai-model-providers";
import { monthStart, preflightSpend } from "@ngriffin_uk/polychat-library-model-registry";
import type {
  ModelBudget,
  ModelProviderId,
  SaveBudgetRequest,
  SpendPreflight,
  SpendSummary,
} from "@ngriffin_uk/polychat-schemas";
import { hoursBetween } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { RepositoryManager } from "~/infrastructure/database/repositoryManager";
import {
  conflict,
  notFound,
  requireModelAction,
  requireWorkspaceProject,
} from "~/modules/model-registry/application/access";

import {
  type ModelBudgetRecord,
  type ModelCostEntryRecord,
  WORKSPACE_BUDGET_SCOPE_KEY,
} from "../infrastructure/ModelSpendRepository";

const ACTIVE_DEPLOYMENT_STATUSES = new Set(["provisioning", "running", "updating"]);

export function toModelBudget(record: ModelBudgetRecord): ModelBudget {
  return {
    id: record.id,
    workspaceId: record.workspace_id,
    projectId: record.project_id,
    monthlyLimitUsd: record.monthly_limit_usd,
    softLimitPercent: record.soft_limit_percent,
    hardStop: record.hard_stop,
    approvalAboveUsd: record.approval_above_usd,
    idlePauseMinutes: record.idle_pause_minutes,
    updatedAt: record.updated_at,
    updatedBy: record.updated_by,
  };
}

function monthEnd(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

interface SpendLedger {
  budgets: ModelBudgetRecord[];
  costs: ModelCostEntryRecord[];
  committed: Array<{ projectId: string | null; usd: number }>;
}

async function loadLedger(
  repositories: RepositoryManager,
  workspaceId: string,
  now: Date,
): Promise<SpendLedger> {
  const since = monthStart(now);
  const end = monthEnd(now);
  const [budgets, costs, runs, deployments] = await Promise.all([
    repositories.modelSpend.listBudgets(workspaceId),
    repositories.modelSpend.listCosts(workspaceId, since),
    repositories.modelTraining.list(workspaceId, null, true),
    repositories.modelDeployments.list(workspaceId, { liveOnly: true }),
  ]);
  const spentBySubject = new Map<string, number>();

  for (const cost of costs) {
    const key = `${cost.subject_type}:${cost.subject_id}`;

    spentBySubject.set(key, (spentBySubject.get(key) ?? 0) + cost.usd);
  }

  return {
    budgets,
    costs,
    committed: [
      ...runs.map((run) => ({
        projectId: run.project_id,
        usd: Math.max(
          0,
          (run.estimate.usd ?? 0) - (spentBySubject.get(`training_run:${run.id}`) ?? 0),
        ),
      })),
      ...deployments
        .filter(
          (deployment) =>
            ACTIVE_DEPLOYMENT_STATUSES.has(deployment.status) &&
            deployment.spec.scaling.minReplicas > 0 &&
            deployment.hourly_usd !== null,
        )
        .map((deployment) => ({
          projectId: deployment.project_id,
          usd: (deployment.hourly_usd ?? 0) * hoursBetween(now.toISOString(), end),
        })),
    ],
  };
}

function sum(values: number[]): number {
  return Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
}

export async function getWorkspaceSpendLines(
  repositories: RepositoryManager,
  workspaceId: string,
  now = new Date(),
  projectId?: string | null,
) {
  const ledger = await loadLedger(repositories, workspaceId, now);

  return ledger.budgets
    .filter(
      (budget) =>
        projectId === undefined || budget.project_id === null || budget.project_id === projectId,
    )
    .map((budget) => {
      const inScope = (item: { projectId: string | null }) =>
        budget.project_id === null || item.projectId === budget.project_id;

      return {
        budget: toModelBudget(budget),
        spentUsd: sum(
          ledger.costs
            .filter((cost) => inScope({ projectId: cost.project_id }))
            .map((cost) => cost.usd),
        ),
        committedUsd: sum(ledger.committed.filter(inScope).map((item) => item.usd)),
      };
    });
}

export async function preflightWorkspaceSpend(
  repositories: RepositoryManager,
  workspaceId: string,
  projectId: string | null,
  estimateUsd: number | null,
  now = new Date(),
): Promise<SpendPreflight> {
  return preflightSpend(
    await getWorkspaceSpendLines(repositories, workspaceId, now, projectId),
    estimateUsd,
  );
}

export async function getSpendSummary(
  context: ServiceContext,
  workspaceId: string,
): Promise<SpendSummary> {
  await requireModelAction(context, workspaceId, "view");

  const now = new Date();
  const repositories = context.repositories;
  const ledger = await loadLedger(repositories, workspaceId, now);
  const [runs, deployments] = await Promise.all([
    repositories.modelTraining.list(workspaceId),
    repositories.modelDeployments.list(workspaceId),
  ]);
  const names = new Map<string, string>([
    ...runs.map((run) => [`training_run:${run.id}`, run.spec.outputName] as const),
    ...deployments.map((deployment) => [`deployment:${deployment.id}`, deployment.name] as const),
  ]);
  const projectIds = [
    ...new Set([
      ...ledger.costs.map((cost) => cost.project_id),
      ...ledger.budgets.map((budget) => budget.project_id),
    ]),
  ].filter((projectId): projectId is string => projectId !== null);
  const line = (projectId: string | null) => {
    const matches = (value: string | null) => projectId === null || value === projectId;

    return {
      projectId,
      spentUsd: sum(
        ledger.costs.filter((cost) => matches(cost.project_id)).map((cost) => cost.usd),
      ),
      committedUsd: sum(
        ledger.committed.filter((item) => matches(item.projectId)).map((item) => item.usd),
      ),
      limitUsd:
        ledger.budgets.find((budget) => budget.project_id === projectId)?.monthly_limit_usd ?? null,
    };
  };

  const bySubject = new Map<string, SpendSummary["bySubject"][number]>();

  for (const cost of ledger.costs) {
    const key = `${cost.subject_type}:${cost.subject_id}`;
    const existing = bySubject.get(key);

    bySubject.set(key, {
      subjectType: cost.subject_type,
      subjectId: cost.subject_id,
      name: names.get(key) ?? cost.subject_id,
      provider: cost.provider,
      usd: Math.round(((existing?.usd ?? 0) + cost.usd) * 100) / 100,
    });
  }

  return {
    periodStart: monthStart(now),
    workspace: line(null),
    projects: projectIds.map(line),
    bySubject: [...bySubject.values()].sort((left, right) => right.usd - left.usd),
    budgets: ledger.budgets.map(toModelBudget),
  };
}

export async function saveBudget(
  context: ServiceContext,
  workspaceId: string,
  request: SaveBudgetRequest,
): Promise<ModelBudget> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_budgets");
  const projectId = await requireWorkspaceProject(context, workspaceId, request.projectId);

  if ((request.hardStop ?? true) || request.idlePauseMinutes != null) {
    const deployments = await context.repositories.modelDeployments.list(workspaceId, {
      liveOnly: true,
      projectId,
    });
    const unsupported = deployments.find(
      (deployment) => hostManifest(deployment.provider, deployment.host).pauseSupported === false,
    );

    if (unsupported) {
      throw conflict(
        `${unsupported.name} uses a host that cannot pause. Remove that deployment before enabling a budget hard stop or idle pause.`,
      );
    }
  }

  const saved = await context.repositories.modelSpend.saveBudget({
    workspaceId,
    projectId,
    monthlyLimitUsd: request.monthlyLimitUsd,
    softLimitPercent: request.softLimitPercent ?? 80,
    hardStop: request.hardStop ?? true,
    approvalAboveUsd: request.approvalAboveUsd ?? null,
    idlePauseMinutes: request.idlePauseMinutes ?? null,
    updatedBy: userId,
  });

  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_budget.saved",
    targetType: "model_budget",
    targetId: saved.id,
    metadata: { ...request },
  });

  return toModelBudget(saved);
}

export async function deleteBudget(
  context: ServiceContext,
  workspaceId: string,
  projectId: string | null,
): Promise<{ deleted: true }> {
  const { userId } = await requireModelAction(context, workspaceId, "manage_budgets");
  const scopeKey =
    (await requireWorkspaceProject(context, workspaceId, projectId)) ?? WORKSPACE_BUDGET_SCOPE_KEY;
  const existing = (await context.repositories.modelSpend.listBudgets(workspaceId)).find(
    (budget) => budget.scope_key === scopeKey,
  );

  if (!existing) {
    throw notFound("Budget");
  }

  await context.repositories.modelSpend.deleteBudget(workspaceId, scopeKey);
  await context.repositories.audit.createRecord({
    workspaceId,
    actorUserId: userId,
    action: "model_budget.deleted",
    targetType: "model_budget",
    targetId: existing.id,
  });

  return { deleted: true };
}

export async function accrueDeploymentCost(
  repositories: RepositoryManager,
  deployment: {
    id: string;
    workspace_id: string;
    project_id: string | null;
    provider: ModelProviderId;
    hourly_usd: number | null;
    billed_until: string | null;
    created_at: string;
  },
  billable: boolean,
  now = new Date(),
): Promise<string> {
  const from = deployment.billed_until ?? deployment.created_at;
  const to = now.toISOString();

  await repositories.modelSpend.accrueDeployment({
    workspaceId: deployment.workspace_id,
    deploymentId: deployment.id,
    expectedBilledUntil: deployment.billed_until,
    periodStart: from,
    periodEnd: to,
    usd:
      billable && deployment.hourly_usd !== null
        ? Math.round(deployment.hourly_usd * hoursBetween(from, to) * 10_000) / 10_000
        : 0,
  });

  return to;
}
