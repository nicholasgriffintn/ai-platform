import type { ChatRun, WorkInboxItem } from "@ngriffin_uk/polychat-schemas";
import { humaniseIdentifier } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";

function waitingActor(run: ChatRun, teammateName: string | null): string {
  if (teammateName) {
    return teammateName;
  }

  return run.recipeInstallationId ? "A routine" : "A conversation";
}

function waitingTitle(actor: string, status: string, toolName: string | null): string {
  if (status === "awaiting_approval") {
    return toolName
      ? `${actor} wants your approval to ${humaniseIdentifier(toolName).toLowerCase()}`
      : `${actor} is waiting for your approval`;
  }

  return status === "awaiting_input"
    ? `${actor} has a question for you`
    : `${actor} needs you to take over its computer`;
}

function waitingLink(run: ChatRun, workspaceId: string | null): string {
  const conversation = encodeURIComponent(run.conversationId);

  return workspaceId && run.projectId
    ? `/work/${encodeURIComponent(workspaceId)}/projects/${encodeURIComponent(run.projectId)}/chat/${conversation}`
    : `/chat/${conversation}`;
}

export async function listWaitingRunInboxItems(
  context: ServiceContext,
  params: { userId: number; workspaceIds: ReadonlySet<string> },
): Promise<WorkInboxItem[]> {
  const waiting = (
    await context.repositories.get(ConversationRunRepository).listWaitingForUser(params.userId)
  ).filter((entry) => entry.workspaceId === null || params.workspaceIds.has(entry.workspaceId));
  const teammateIds = [
    ...new Set(waiting.flatMap((entry) => (entry.teammateId ? [entry.teammateId] : []))),
  ];
  const [teammates, pendingCalls] = await Promise.all([
    context.repositories.get(TeammateRepository).getTeammatesByIds(teammateIds),
    context.repositories
      .get(MessageRepository)
      .listPendingToolCallsForRuns(waiting.map((entry) => entry.run.id)),
  ]);
  const names = new Map(teammates.map((teammate) => [teammate.id, teammate.name]));
  const pendingCallByRun = new Map(pendingCalls.map((call) => [call.run_id, call]));

  return waiting.map(({ run, workspaceId, teammateId }) => {
    const pendingCall = pendingCallByRun.get(run.id);

    return {
      id: `waiting:${run.id}:${run.attempt}`,
      kind: "waiting",
      workspaceId,
      projectId: workspaceId ? (run.projectId ?? null) : null,
      taskId: null,
      teammateId,
      title: waitingTitle(
        waitingActor(run, teammateId ? (names.get(teammateId) ?? null) : null),
        run.status,
        pendingCall?.name ?? null,
      ),
      detail: pendingCall?.content ?? run.terminalReason,
      dueAt: null,
      conversationId: run.conversationId,
      since: run.updatedAt,
      deepLink: waitingLink(run, workspaceId),
    };
  });
}
