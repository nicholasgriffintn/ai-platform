import { resolveServiceContext, type ServiceContext } from "~/lib/context/serviceContext";
import type { IEnv, User } from "~/types";
import { mapWithConcurrency } from "~/utils/async";

export interface ExportRow {
  conversation_id: string;
  conversation_title: string | null;
  conversation_created_at: string | null;
  message_id: string;
  message_role: string | null;
  message_content: string | null;
  message_timestamp: string | number | null;
  message_model: string | null;
}

const CONVERSATION_PAGE_SIZE = 100;
const MESSAGE_PAGE_SIZE = 500;
const MAX_MESSAGE_PAGES = 10000;
const CONVERSATION_CONCURRENCY = 8;

async function collectConversationRows(
  serviceContext: ServiceContext,
  conversation: Record<string, unknown>,
): Promise<ExportRow[]> {
  const conversationId = String(conversation.id);
  const conversationTitle = (conversation.title as string) ?? null;
  const conversationCreatedAt = (conversation.created_at as string) ?? null;

  const rows: ExportRow[] = [];

  let after: string | undefined;
  let iterations = 0;

  while (true) {
    const messages = await serviceContext.repositories.messages.getConversationMessages(
      conversationId,
      MESSAGE_PAGE_SIZE,
      after,
      { includeArchived: true },
    );

    if (!messages.length) {
      break;
    }

    const endCursor = String(messages[messages.length - 1].id);

    if (after && endCursor === after) {
      break;
    }

    for (const message of messages) {
      rows.push({
        conversation_id: conversationId,
        conversation_title: conversationTitle,
        conversation_created_at: conversationCreatedAt,
        message_id: String(message.id),
        message_role: (message.role as string) ?? null,
        message_content:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? null),
        message_timestamp: (message.timestamp as string | number | null) ?? null,
        message_model: (message.model as string | null) ?? null,
      });
    }

    after = endCursor;
    if (++iterations >= MAX_MESSAGE_PAGES) {
      break;
    }
  }

  return rows;
}

export async function handleExportChatHistory({
  context,
  env,
  user,
}: {
  context?: ServiceContext;
  env?: IEnv;
  user: User;
}): Promise<ExportRow[]> {
  const serviceContext = resolveServiceContext({ context, env, user });

  const rows: ExportRow[] = [];

  let page = 1;
  let totalPages = 1;

  do {
    const { conversations, totalPages: pageCount } =
      await serviceContext.repositories.conversations.getUserConversations(
        user.id,
        CONVERSATION_PAGE_SIZE,
        page,
        true,
      );

    totalPages = pageCount || 1;

    const conversationRows = await mapWithConcurrency(
      conversations,
      CONVERSATION_CONCURRENCY,
      (conversation) => collectConversationRows(serviceContext, conversation),
    );

    for (const collected of conversationRows) {
      for (const row of collected) {
        rows.push(row);
      }
    }
  } while (page++ < totalPages);

  return rows;
}
