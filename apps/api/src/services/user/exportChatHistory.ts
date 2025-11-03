import {
	resolveServiceContext,
	type ServiceContext,
} from "~/lib/context/serviceContext";
import type { IEnv, User } from "~/types";

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

	const pageSize = 100;
	let page = 1;
	let totalPages = 1;

	do {
		const { conversations, totalPages: tp } =
			await serviceContext.repositories.conversations.getUserConversations(
				user.id,
				pageSize,
				page,
				true,
			);
		totalPages = tp || 1;

		for (const convo of conversations) {
			const conversationId = String(convo.id);
			const conversationTitle = (convo.title as string) ?? null;
			const conversationCreatedAt = (convo.created_at as string) ?? null;

			const messagePageSize = 500;
			let after: string | undefined = undefined;
			let iterations = 0;
			const maxIterations = 10000;

			while (true) {
				const messages =
					await serviceContext.repositories.messages.getConversationMessages(
						conversationId,
						messagePageSize,
						after,
					);
				if (!messages.length) break;

				const endCursor = String(messages[messages.length - 1].id);
				if (after && endCursor === after) {
					break;
				}

				for (const m of messages) {
					rows.push({
						conversation_id: conversationId,
						conversation_title: conversationTitle,
						conversation_created_at: conversationCreatedAt,
						message_id: String(m.id),
						message_role: (m.role as string) ?? null,
						message_content:
							typeof m.content === "string"
								? (m.content as string)
								: JSON.stringify(m.content ?? null),
						message_timestamp: (m.timestamp as string | number | null) ?? null,
						message_model: (m.model as string | null) ?? null,
					});
				}
				after = endCursor;
				if (++iterations >= maxIterations) {
					break;
				}
			}
		}
	} while (page++ < totalPages);

	return rows;
}
