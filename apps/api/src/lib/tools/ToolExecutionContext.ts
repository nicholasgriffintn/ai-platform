import type { ToolExecutionContext as BaseToolExecutionContext } from "@assistant/schemas";
import type { ConversationManager } from "~/lib/conversationManager";
import type { IEnv, IFunctionResponse, IRequest, IUser } from "~/types";

export interface ToolExecutionContext extends BaseToolExecutionContext<
	IEnv,
	IUser,
	ConversationManager
> {
	request: IRequest;
	emitToolResult?: (response: IFunctionResponse) => Promise<void> | void;
}
