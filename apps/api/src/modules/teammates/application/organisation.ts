import {
  AGENT_HARNESS_PROVIDER,
  isAgentHarnessId,
  type ProposeHireInput,
  type RunsOn,
  type UpdateWorkspaceTeammateInput,
  usagePeriodFromDate,
  type WorkspaceTeammate,
  type WorkspaceTeamResponse,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { Teammate } from "~/infrastructure/database/schema";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { findModelConfig } from "~/modules/models/application/resolve";
import { resolveExecutionRoute } from "~/modules/models/domain/execution-route";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import { requireWorkspaceAccess } from "~/modules/workspaces/application/access";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { TEAMMATE_CAPABILITY_KIND } from "./access";
import { hireTeammate } from "./hire";

async function resolveRunsOn(context: ServiceContext, teammate: Teammate): Promise<RunsOn> {
  if (!teammate.model) {
    return "hosted";
  }

  const model = await findModelConfig(teammate.model, context.env);
  const route = resolveExecutionRoute(model);

  if (
    route === "hosted" &&
    (model?.provider === AGENT_HARNESS_PROVIDER || isAgentHarnessId(model?.provider))
  ) {
    return "harness";
  }

  return route;
}

export async function readTeammateSpendByWorkspace(
  context: ServiceContext,
  workspaceId: string,
): Promise<Map<string, number>> {
  const rows = await context.repositories.get(UsageEventRepository).summariseWorkspaceSpend({
    workspaceId,
    period: usagePeriodFromDate(),
    groupBy: "teammate",
  });

  return new Map(rows.map((row) => [row.group_id, Math.max(0, Math.round(row.credit_micros))]));
}

async function adoptWorkspaceOwnedTeammates(
  context: ServiceContext,
  workspaceId: string,
  records: WorkspaceTeammateRecord[],
  responsibleUserId: number,
): Promise<WorkspaceTeammateRecord[]> {
  const owned = await context.repositories.get(TeammateRepository).listForWorkspace(workspaceId);
  const known = new Set(records.map((record) => record.teammateId));
  const adopted = await Promise.all(
    owned
      .filter((teammate) => !known.has(teammate.id))
      .map((teammate) =>
        context.repositories.get(WorkspaceTeammateRepository).create({
          workspaceId,
          teammateId: teammate.id,
          title: teammate.kind === "bot" ? "Bot" : "Teammate",
          reportsToTeammateId: null,
          status: "active",
          responsibleUserId,
          heartbeatMinutes: null,
          monthlyCreditCapMicros: null,
          projectIds: [],
          proposal: null,
        }),
      ),
  );

  return [...records, ...adopted];
}

export async function getWorkspaceTeam(
  context: ServiceContext,
  workspaceId: string,
): Promise<WorkspaceTeamResponse> {
  const user = context.requireUser();
  const { workspace } = await requireWorkspaceAccess(context, workspaceId);
  const stored = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(workspaceId);
  const records = await adoptWorkspaceOwnedTeammates(context, workspaceId, stored, user.id);
  const [teammates, spend] = await Promise.all([
    context.repositories
      .get(TeammateRepository)
      .getTeammatesByIds(records.map((record) => record.teammateId)),
    readTeammateSpendByWorkspace(context, workspaceId),
  ]);
  const byId = new Map(teammates.map((teammate) => [teammate.id, teammate]));
  const formatted = await Promise.all(
    records.flatMap((record) => {
      const teammate = byId.get(record.teammateId);

      return teammate
        ? [
            formatWorkspaceTeammate(context, record, teammate, {
              spentCreditMicros: spend.get(record.teammateId) ?? 0,
              leadTeammateId: workspace.lead_teammate_id ?? null,
            }),
          ]
        : [];
    }),
  );

  return {
    teammates: formatted,
    monthlyCreditCapMicros: workspace.monthly_credit_cap_micros ?? null,
    leadTeammateId: workspace.lead_teammate_id ?? null,
  };
}

async function formatWorkspaceTeammate(
  context: ServiceContext,
  record: WorkspaceTeammateRecord,
  teammate: Teammate,
  extras: { spentCreditMicros: number; leadTeammateId: string | null },
): Promise<WorkspaceTeammate> {
  return {
    workspaceId: record.workspaceId,
    teammateId: record.teammateId,
    name: teammate.name,
    avatarUrl: teammate.avatar_url,
    characterId: teammate.character_id,
    title: record.title,
    reportsToTeammateId: record.reportsToTeammateId,
    status: record.status,
    pausedReason: record.pausedReason,
    responsibleUserId: record.responsibleUserId,
    heartbeatMinutes: record.heartbeatMinutes,
    lastHeartbeatAt: record.lastHeartbeatAt,
    lastWake: record.lastWake,
    monthlyCreditCapMicros: record.monthlyCreditCapMicros,
    spentCreditMicros: extras.spentCreditMicros,
    isLead: extras.leadTeammateId === record.teammateId,
    runsOn: await resolveRunsOn(context, teammate),
    proposal: record.proposal,
    projectIds: record.projectIds,
    createdAt: record.createdAt,
  };
}

async function requireEmployment(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
): Promise<WorkspaceTeammateRecord> {
  const record = await context.repositories
    .get(WorkspaceTeammateRepository)
    .get(workspaceId, teammateId);

  if (!record) {
    throw new AssistantError("That teammate is not on this team", ErrorType.NOT_FOUND, 404);
  }

  return record;
}

async function assertNoReportingCycle(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
  managerId: string | null,
): Promise<void> {
  if (!managerId) {
    return;
  }

  const records = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(workspaceId);
  const managers = new Map(
    records.map((record) => [record.teammateId, record.reportsToTeammateId]),
  );

  if (!managers.has(managerId)) {
    throw new AssistantError("The manager must be on this team", ErrorType.PARAMS_ERROR, 400);
  }

  let current: string | null = managerId;
  const seen = new Set<string>();

  while (current) {
    if (current === teammateId || seen.has(current)) {
      throw new AssistantError(
        "That would make a teammate report to itself",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    seen.add(current);
    current = managers.get(current) ?? null;
  }
}

async function grantProjects(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
  projectIds: readonly string[],
): Promise<void> {
  const user = context.requireUser();
  const repository = context.repositories.get(WorkspaceRepository);

  for (const projectId of projectIds) {
    const project = await repository.getProject(projectId);

    if (!project || project.workspace_id !== workspaceId) {
      throw new AssistantError(
        "That project is not in this workspace",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const capabilities = await repository.listProjectCapabilities(projectId);
    const granted = capabilities.some(
      (capability) =>
        capability.kind === TEAMMATE_CAPABILITY_KIND && capability.capability_id === teammateId,
    );

    if (!granted) {
      await repository.addProjectCapability({
        id: generateId(),
        projectId,
        kind: TEAMMATE_CAPABILITY_KIND,
        capabilityId: teammateId,
        createdBy: user.id,
      });
    }
  }
}

export async function updateWorkspaceTeammate(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
  input: UpdateWorkspaceTeammateInput,
): Promise<WorkspaceTeammate> {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const record = await requireEmployment(context, workspaceId, teammateId);

  if (record.status === "proposed") {
    throw new AssistantError("Decide on the hire first", ErrorType.CONFLICT_ERROR, 409);
  }

  if (input.reportsToTeammateId !== undefined) {
    await assertNoReportingCycle(context, workspaceId, teammateId, input.reportsToTeammateId);
  }

  if (input.projectIds) {
    await grantProjects(context, workspaceId, teammateId, input.projectIds);
  }

  const raisesBudget =
    input.monthlyCreditCapMicros !== undefined &&
    record.pausedReason === "budget" &&
    (input.monthlyCreditCapMicros === null ||
      input.monthlyCreditCapMicros > (record.monthlyCreditCapMicros ?? 0));
  const nextStatus = input.status ?? (raisesBudget ? "active" : undefined);

  await context.repositories.get(WorkspaceTeammateRepository).update(workspaceId, teammateId, {
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.reportsToTeammateId !== undefined
      ? { reportsToTeammateId: input.reportsToTeammateId }
      : {}),
    ...(input.heartbeatMinutes !== undefined ? { heartbeatMinutes: input.heartbeatMinutes } : {}),
    ...(input.monthlyCreditCapMicros !== undefined
      ? {
          monthlyCreditCapMicros: input.monthlyCreditCapMicros,
          budgetWarnedPeriod: null,
          budgetAlertAt: null,
        }
      : {}),
    ...(input.projectIds !== undefined ? { projectIds: input.projectIds } : {}),
    ...(nextStatus !== undefined
      ? { status: nextStatus, pausedReason: nextStatus === "paused" ? "manual" : null }
      : {}),
  });
  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.teammate.updated",
    targetType: "teammate",
    targetId: teammateId,
    metadata: { fields: Object.keys(input) },
  });

  const team = await getWorkspaceTeam(context, workspaceId);
  const updated = team.teammates.find((teammate) => teammate.teammateId === teammateId);

  if (!updated) {
    throw new AssistantError("Teammate not found", ErrorType.NOT_FOUND, 404);
  }

  return updated;
}

export async function proposeHire(
  context: ServiceContext,
  workspaceId: string,
  input: ProposeHireInput,
  proposer: { teammateId: string | null },
): Promise<WorkspaceTeammate> {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId);

  if (input.reportsToTeammateId) {
    await requireEmployment(context, workspaceId, input.reportsToTeammateId);
  }

  const hired = await hireTeammate(context, {
    ...(input.roleSlug ? { role_slug: input.roleSlug } : {}),
    ...(input.jobDescription ? { job_description: input.jobDescription } : {}),
    name: input.name,
    workspace_id: workspaceId,
  });

  await context.repositories.get(WorkspaceTeammateRepository).create({
    workspaceId,
    teammateId: hired.id,
    title: input.title,
    reportsToTeammateId: input.reportsToTeammateId,
    status: "proposed",
    responsibleUserId: user.id,
    heartbeatMinutes: input.heartbeatMinutes,
    monthlyCreditCapMicros: input.monthlyCreditCapMicros,
    projectIds: input.projectIds,
    proposal: {
      reason: input.reason,
      proposedByTeammateId: proposer.teammateId,
      proposedByUserId: proposer.teammateId ? null : user.id,
      roleSlug: input.roleSlug,
      jobDescription: input.jobDescription,
      projectIds: input.projectIds,
      proposedAt: new Date().toISOString(),
    },
  });
  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: "workspace.teammate.proposed",
    targetType: "teammate",
    targetId: hired.id,
    metadata: { proposedByTeammateId: proposer.teammateId, title: input.title },
  });

  const team = await getWorkspaceTeam(context, workspaceId);
  const proposed = team.teammates.find((teammate) => teammate.teammateId === hired.id);

  if (!proposed) {
    throw new AssistantError("The proposal was not recorded", ErrorType.DATABASE_ERROR);
  }

  return proposed;
}

export async function decideHire(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
  decision: "approve" | "reject",
): Promise<WorkspaceTeamResponse> {
  const user = context.requireUser();

  await requireWorkspaceAccess(context, workspaceId, ["owner", "admin"]);
  const record = await requireEmployment(context, workspaceId, teammateId);

  if (record.status !== "proposed") {
    throw new AssistantError("That hire has already been decided", ErrorType.CONFLICT_ERROR, 409);
  }

  if (decision === "approve") {
    await grantProjects(context, workspaceId, teammateId, record.projectIds);
    await context.repositories.get(WorkspaceTeammateRepository).update(workspaceId, teammateId, {
      status: "active",
      pausedReason: null,
    });
  } else {
    await context.repositories.get(WorkspaceTeammateRepository).delete(workspaceId, teammateId);
    await context.repositories.get(TeammateRepository).deleteTeammate(teammateId);
  }

  await context.repositories.get(AuditRepository).createRecord({
    workspaceId,
    actorUserId: user.id,
    action: decision === "approve" ? "workspace.teammate.hired" : "workspace.teammate.rejected",
    targetType: "teammate",
    targetId: teammateId,
  });

  return getWorkspaceTeam(context, workspaceId);
}

export async function employTeammate(
  context: ServiceContext,
  params: {
    workspaceId: string;
    teammateId: string;
    title: string;
    reportsToTeammateId: string | null;
    heartbeatMinutes: number | null;
    monthlyCreditCapMicros: number | null;
    projectIds: string[];
  },
): Promise<WorkspaceTeammateRecord> {
  const user = context.requireUser();

  await grantProjects(context, params.workspaceId, params.teammateId, params.projectIds);

  return context.repositories.get(WorkspaceTeammateRepository).create({
    ...params,
    status: "active",
    responsibleUserId: user.id,
    proposal: null,
  });
}

export function describeEmploymentUnavailable(
  record: Pick<WorkspaceTeammateRecord, "status" | "pausedReason">,
  name: string,
): string {
  if (record.status === "paused" && record.pausedReason === "budget") {
    return `${name} is paused because it has used its monthly budget. Raise its cap on the Team page to resume.`;
  }

  if (record.status === "paused") {
    return `${name} is paused. Resume it on the Team page first.`;
  }

  if (record.status === "proposed") {
    return `${name} has not been hired yet. Approve the hire in Inbox first.`;
  }

  return `${name} has left the team.`;
}

export async function assertTeammateEmploymentAvailable(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
): Promise<void> {
  const record = await context.repositories
    .get(WorkspaceTeammateRepository)
    .get(workspaceId, teammateId);

  if (!record) {
    return;
  }

  const teammate = await context.repositories.get(TeammateRepository).getTeammateById(teammateId);
  const name = teammate?.name ?? "This teammate";

  if (record.status !== "active") {
    throw new AssistantError(
      describeEmploymentUnavailable(record, name),
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!record.monthlyCreditCapMicros) {
    return;
  }

  const spend = await readTeammateSpendByWorkspace(context, workspaceId);

  if ((spend.get(teammateId) ?? 0) < record.monthlyCreditCapMicros) {
    return;
  }

  await context.repositories.get(WorkspaceTeammateRepository).update(workspaceId, teammateId, {
    status: "paused",
    pausedReason: "budget",
  });

  throw new AssistantError(
    describeEmploymentUnavailable({ status: "paused", pausedReason: "budget" }, name),
    ErrorType.RATE_LIMIT_ERROR,
    429,
  );
}

export async function managesTeammate(
  context: ServiceContext,
  workspaceId: string,
  managerId: string,
  teammateId: string,
): Promise<boolean> {
  const records = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspace(workspaceId);
  const managers = new Map(
    records.map((record) => [record.teammateId, record.reportsToTeammateId]),
  );
  const seen = new Set<string>();
  let current = managers.get(teammateId) ?? null;

  while (current && !seen.has(current)) {
    if (current === managerId) {
      return true;
    }

    seen.add(current);
    current = managers.get(current) ?? null;
  }

  return false;
}

export async function resolveManager(
  context: ServiceContext,
  workspaceId: string,
  teammateId: string,
): Promise<{ type: "teammate"; id: string } | { type: "person"; userId: number }> {
  const record = await context.repositories
    .get(WorkspaceTeammateRepository)
    .get(workspaceId, teammateId);

  if (record?.reportsToTeammateId) {
    const manager = await context.repositories
      .get(WorkspaceTeammateRepository)
      .get(workspaceId, record.reportsToTeammateId);

    if (manager?.status === "active") {
      return { type: "teammate", id: manager.teammateId };
    }
  }

  return { type: "person", userId: record?.responsibleUserId ?? context.requireUser().id };
}
