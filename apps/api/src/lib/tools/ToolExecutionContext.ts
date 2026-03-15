import type { ToolExecutionContext as BaseToolExecutionContext } from "@assistant/schemas";
import type { ConversationManager } from "~/lib/conversationManager";
import type { IEnv, IRequest, IUser } from "~/types";

export interface ToolExecutionContext extends BaseToolExecutionContext<
	IEnv,
	IUser,
	ConversationManager
> {
	request: IRequest;
}
