import type { ToolDefinition, ToolExecutionContext } from "@ngriffin_uk/polychat-library-tools";

import type { ConversationManager } from "~/modules/conversations/application/manager";
import type { IEnv, IFunctionResponse, IRequest, IUser } from "~/types";

export type ApiToolExecutionContext = ToolExecutionContext<
  IEnv,
  IUser,
  ConversationManager,
  IRequest,
  IFunctionResponse
>;

export type ApiToolDefinition = ToolDefinition<any, IFunctionResponse, ApiToolExecutionContext>;
