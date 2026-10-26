import { usagePeriodFromDate, type WorkInboxItem } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
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
): WorkInboxItem | null {
  const base = {
    workspaceId: employment.workspaceId,
    projectId: null,
    taskId: null,
    teammateId: employment.teammateId,
    dueAt: null,
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
      since: employment.createdAt,
    };
  }

  if (employment.status === "active" && employment.budgetWarnedPeriod === period) {
    return {
      ...base,
      id: `budget:${employment.workspaceId}:${employment.teammateId}:${period}`,
      kind: "budget",
      title: `${name} has used 80% of its monthly budget`,
      detail: "It pauses at 100%. Raise the cap on the Team page if it needs more.",
      since: employment.createdAt,
    };
  }

  return null;
}

function waitingTitle(name: string, status: string): string {
  if (status === "awaiting_approval") {
    return `${name} is waiting for your approval`;
  }

  return status === "awaiting_input"
    ? `${name} has a question for you`
    : `${name} needs you to take over its computer`;
}

export async function listTeammateInboxItems(
  context: ServiceContext,
  params: {
    userId: number;
    workspaceIds: readonly string[];
    managedWorkspaceIds: ReadonlySet<string>;
  },
): Promise<WorkInboxItem[]> {
  const employments = await context.repositories
    .get(WorkspaceTeammateRepository)
    .listForWorkspaces(params.workspaceIds);
  const teammateIds = [...new Set(employments.map((employment) => employment.teammateId))];
  const [teammates, teammateContexts] = await Promise.all([
    context.repositories.get(TeammateRepository).getTeammatesByIds(teammateIds),
    context.repositories.get(TeammateContextRepository).listAllForTeammates(teammateIds),
  ]);
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));
  const contexts = teammateContexts.filter(
    (candidate) =>
      candidate.actorUserId === params.userId &&
      candidate.scope.type === "workspace" &&
      params.workspaceIds.includes(candidate.scope.id),
  );
  const waitingRuns = await context.repositories
    .get(ConversationRunRepository)
    .listWaitingForTeammateContexts(contexts.map((candidate) => candidate.id));
  const period = usagePeriodFromDate();

  return [
    ...employments
      .filter((employment) => params.managedWorkspaceIds.has(employment.workspaceId))
      .flatMap((employment) => {
        const item = employmentItem(
          employment,
          names.get(employment.teammateId) ?? "A teammate",
          period,
        );

        return item ? [item] : [];
      }),
    ...waitingRuns.flatMap((run): WorkInboxItem[] => {
      const teammateContext = contexts.find((candidate) => candidate.id === run.teammateContextId);

      if (!teammateContext || !run.projectId) {
        return [];
      }

      return [
        {
          id: `waiting:${run.id}:${run.attempt}`,
          kind: "waiting",
          workspaceId: teammateContext.scope.id,
          projectId: run.projectId,
          taskId: null,
          teammateId: teammateContext.teammateId,
          title: waitingTitle(names.get(teammateContext.teammateId) ?? "A teammate", run.status),
          detail: run.terminalReason,
          dueAt: null,
          since: run.updatedAt,
          deepLink: `/work/${encodeURIComponent(teammateContext.scope.id)}/projects/${encodeURIComponent(run.projectId)}/chat/${encodeURIComponent(run.conversationId)}`,
        },
      ];
    }),
  ];
}
