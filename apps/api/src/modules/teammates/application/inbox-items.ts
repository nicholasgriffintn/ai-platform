import { usagePeriodFromDate, type WorkInboxItem } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import {
  WorkspaceTeammateRepository,
  type WorkspaceTeammateRecord,
} from "~/modules/teammates/infrastructure/WorkspaceTeammateRepository";

function teammateLink(workspaceId: string, teammateId: string): string {
  return `/work/${encodeURIComponent(workspaceId)}/team/${encodeURIComponent(teammateId)}`;
}

function employmentItem(
  employment: WorkspaceTeammateRecord,
  name: string,
  period: string,
  managedByTeammate: boolean,
): WorkInboxItem | null {
  const base = {
    workspaceId: employment.workspaceId,
    projectId: null,
    taskId: null,
    teammateId: employment.teammateId,
    dueAt: null,
    conversationId: null,
    deepLink: teammateLink(employment.workspaceId, employment.teammateId),
  };

  if (employment.status === "proposed" && employment.proposal) {
    return {
      ...base,
      id: `hire:${employment.workspaceId}:${employment.teammateId}`,
      kind: "hire",
      title: `Hire ${name} as ${employment.title}`,
      detail: employment.proposal.reason,
      since: employment.proposal.proposedAt,
    };
  }

  if (employment.status === "paused" && employment.pausedReason === "budget") {
    return {
      ...base,
      id: `paused:${employment.workspaceId}:${employment.teammateId}`,
      kind: "paused",
      title: `${name} is paused: monthly budget used`,
      detail: "Raise its cap on the Team page to resume its work.",
      since: employment.budgetAlertAt ?? employment.createdAt,
    };
  }

  if (
    employment.status === "active" &&
    employment.budgetWarnedPeriod === period &&
    !managedByTeammate
  ) {
    return {
      ...base,
      id: `budget:${employment.workspaceId}:${employment.teammateId}:${period}`,
      kind: "budget",
      title: `${name} has used 80% of its monthly budget`,
      detail: "It pauses at 100%. Raise the cap on the Team page if it needs more.",
      since: employment.budgetAlertAt ?? employment.createdAt,
    };
  }

  return null;
}

export async function listTeammateInboxItems(
  context: ServiceContext,
  params: {
    workspaceIds: readonly string[];
    managedWorkspaceIds: ReadonlySet<string>;
  },
): Promise<WorkInboxItem[]> {
  const employments = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspaces(params.workspaceIds);
  const teammateIds = [...new Set(employments.map((employment) => employment.teammateId))];
  const teammates = await context.repositories
    .get(TeammateRepository)
    .getTeammatesByIds(teammateIds);
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));
  const period = usagePeriodFromDate();
  const activeTeammates = new Set(
    employments
      .filter((employment) => employment.status === "active")
      .map((employment) => `${employment.workspaceId}:${employment.teammateId}`),
  );

  return employments
    .filter((employment) => params.managedWorkspaceIds.has(employment.workspaceId))
    .flatMap((employment) => {
      const item = employmentItem(
        employment,
        names.get(employment.teammateId) ?? "A teammate",
        period,
        activeTeammates.has(`${employment.workspaceId}:${employment.reportsToTeammateId}`),
      );

      return item ? [item] : [];
    });
}
