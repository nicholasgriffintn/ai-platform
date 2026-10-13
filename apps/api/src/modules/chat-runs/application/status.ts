import { ownsResource } from "@ngriffin_uk/polychat-library-policy";
import {
  CHAT_RUN_EVENT_PROTOCOL_VERSION,
  isTerminalChatRunStatus,
  partialRunMessageId,
  storedChatMessageResponseSchema,
  type ChatRun,
  type ChatRunCommandReceiptResponse,
  type ChatRunSnapshotResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { requireProjectAccess } from "~/modules/workspaces/application/access";
import type { Message } from "~/types";

import { hydrateDelegatedUsage } from "./delegated-usage";
import { reconcileInactiveChatRun } from "./recovery";
import { hydrateChatRunUsage } from "./usage";

async function withRunPartialMessage(
  context: ServiceContext,
  run: ChatRun,
  messages: Message[],
): Promise<Message[]> {
  if (isTerminalChatRunStatus(run.status)) {
    return messages;
  }

  const partial = await context.repositories.conversationRuns.getPartialContent(
    run.id,
    run.attempt,
  );

  if (!partial?.trim()) {
    return messages;
  }

  const partialMessage: Message = {
    id: partialRunMessageId(run.id),
    role: "assistant",
    content: partial,
    status: "in_progress",
    run_id: run.id,
    timestamp: Date.now(),
  };

  return [...messages, partialMessage];
}

export async function requireChatRunAccess(
  context: ServiceContext,
  runId: string,
): Promise<ChatRun> {
  const user = context.requireUser();

  context.ensureDatabase();
  const run = await context.repositories.conversationRuns.getById(runId);

  if (!run) {
    throw new AssistantError("Run not found", ErrorType.NOT_FOUND, 404);
  }

  if (run.projectId) {
    await requireProjectAccess(context, run.projectId);
  } else if (!ownsResource(user.id, run.initiatorUserId)) {
    throw new AssistantError("Run not found", ErrorType.NOT_FOUND, 404);
  }

  return run;
}

export async function handleGetChatRun(context: ServiceContext, runId: string) {
  const run = await reconcileInactiveChatRun(context, await requireChatRunAccess(context, runId));
  const messages = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const [hydratedRun] = await hydrateChatRunUsage(context.repositories, [run]);

  return {
    run: await hydrateDelegatedUsage(context, hydratedRun),
    messages: await withRunPartialMessage(context, run, messages.map(formatStoredMessage)),
  };
}

export async function handleGetChatRunSnapshot(
  context: ServiceContext,
  runId: string,
): Promise<ChatRunSnapshotResponse> {
  const cursor = await context.repositories.conversationRuns.getEventCursor(runId);
  const authoritativeRun = await reconcileInactiveChatRun(
    context,
    await requireChatRunAccess(context, runId),
  );
  const [hydratedRun] = await hydrateChatRunUsage(context.repositories, [authoritativeRun]);
  const run = await hydrateDelegatedUsage(context, hydratedRun);
  const messages = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const withPartial = await withRunPartialMessage(context, run, messages.map(formatStoredMessage));

  return {
    protocolVersion: CHAT_RUN_EVENT_PROTOCOL_VERSION,
    cursor,
    run,
    messages: withPartial.map((message) => storedChatMessageResponseSchema.parse(message)),
  };
}

export async function handleGetChatRunCommand(
  context: ServiceContext,
  commandId: string,
): Promise<ChatRunCommandReceiptResponse> {
  const user = context.requireUser();

  context.ensureDatabase();
  const receipt = await context.repositories.conversationRuns.getCommandReceipt(user.id, commandId);

  if (!receipt) {
    throw new AssistantError("Run command not found", ErrorType.NOT_FOUND, 404);
  }

  await requireChatRunAccess(context, receipt.run.id);

  return { run: receipt };
}
