import type { ListPage } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  ConversationManager,
  type ConversationListOptions,
} from "~/modules/conversations/application/manager";

function managerFor(context: ServiceContext): ConversationManager {
  const user = context.requireUser();

  context.ensureDatabase();

  return ConversationManager.getInstance({ database: context.database, user });
}

export function handleListChatCompletions(
  context: ServiceContext,
  options: ConversationListOptions = {},
): Promise<ListPage<Record<string, unknown>>> {
  return managerFor(context).list(options);
}

export async function handleCountConversations(
  context: ServiceContext,
  options: ConversationListOptions = {},
): Promise<{ count: number }> {
  return { count: await managerFor(context).count(options) };
}
