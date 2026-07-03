import {
	compactChatCompletionResponseSchema,
	type CompactChatCompletionResponse,
} from "@assistant/schemas";
import { ConversationManager } from "~/lib/conversationManager";
import type { ServiceContext } from "~/lib/context/serviceContext";
import { SessionManager } from "~/lib/session/SessionManager";

export type CompactChatCompletionContext = Pick<
	ServiceContext,
	"database" | "ensureDatabase" | "env" | "requireUser"
>;

export async function handleCompactChatCompletion(
	context: CompactChatCompletionContext,
	completion_id: string,
): Promise<CompactChatCompletionResponse> {
	const user = context.requireUser();

	context.ensureDatabase();

	const conversationManager = ConversationManager.getInstance({
		database: context.database,
		user,
		env: context.env,
	});

	const messages = await conversationManager.getAllMessages(completion_id, {
		includeArchived: false,
	});
	const sessionManager = new SessionManager({
		env: context.env,
		conversationManager,
		user,
	});
	const compactedSession = await sessionManager.compact({
		completionId: completion_id,
		messages,
		compaction: "manual",
		mode: messages.at(-1)?.mode,
	});

	const conversation = await conversationManager.getConversationDetails(completion_id, {
		includeArchived: true,
		includeSnapshots: false,
	});

	return compactChatCompletionResponseSchema.parse({
		compacted: compactedSession.compacted,
		conversation,
	});
}
