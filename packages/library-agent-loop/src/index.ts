export { executeAgentLoop } from "./agent-loop.js";
export {
  AGENT_CONTROL_TOOL_NAMES,
  controlToolResultContent,
  FINISH_TOOL_NAME,
  UPDATE_PLAN_TOOL_NAME,
} from "./control-tools.js";
export { truncateForModel } from "./utils.js";
export { parseToolCallArguments } from "@ngriffin_uk/polychat-utility-server/tool-calls";
export {
  resolveApproval,
  type ApprovalClient,
  type ApprovalControlState,
  type ApprovalRecord,
  type ApprovalWindow,
  type ResolveApprovalParams,
  type ResolveApprovalResult,
} from "@ngriffin_uk/polychat-library-interactions";

export type {
  AgentActionContext,
  AgentConfig,
  AgentEvent,
  AgentFinishAssessment,
  AgentGoalOutcome,
  AgentLoopResult,
  AgentLoopState,
  AgentMessage,
  AgentToolCall,
  AgentToolCallExecutor,
  AgentTurn,
  AgentTurnContext,
  AgentTurnResolver,
  ExecuteAgentLoopParams,
} from "./types.js";
