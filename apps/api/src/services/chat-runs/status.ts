import {
  CHAT_RUN_EVENT_PROTOCOL_VERSION,
  storedChatMessageResponseSchema,
  type ChatRun,
  type ChatRunCommandReceiptResponse,
  type ChatRunSnapshotResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { formatStoredMessage } from "~/lib/conversation/stored-message";
import { requireProjectAccess } from "~/services/workspaces/access";
import { AssistantError, ErrorType } from "~/utils/errors";

import { reconcileInactiveChatRun } from "./recovery";
import { hydrateChatRunUsage } from "./usage";

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
  } else if (run.initiatorUserId !== user.id) {
    throw new AssistantError("Run not found", ErrorType.NOT_FOUND, 404);
  }

  return run;
}

export async function handleGetChatRun(context: ServiceContext, runId: string) {
  const run = await reconcileInactiveChatRun(context, await requireChatRunAccess(context, runId));
  const messages = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const [hydratedRun] = await hydrateChatRunUsage(context.repositories, [run]);

  return { run: hydratedRun, messages: messages.map(formatStoredMessage) };
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
  const [run] = await hydrateChatRunUsage(context.repositories, [authoritativeRun]);
  const messages = await context.repositories.messages.getRunMessages(run.conversationId, run.id);

  return {
    protocolVersion: CHAT_RUN_EVENT_PROTOCOL_VERSION,
    cursor,
    run,
    messages: messages.map((message) =>
      storedChatMessageResponseSchema.parse(formatStoredMessage(message)),
    ),
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
