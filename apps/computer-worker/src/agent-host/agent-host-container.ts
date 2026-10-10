import { Sandbox } from "@cloudflare/sandbox";
import type { ModelTier } from "@ngriffin_uk/polychat-schemas";

import {
  AGENT_HOST_EGRESS_HANDLER,
  AGENT_HOST_SLEEP_AFTER,
  POLYCHAT_MODELS_HANDLER,
} from "../config/agent-host";
import type { Env } from "../types";
import { agentHostEgressOutbound, polychatModelsOutbound } from "./outbound";

const AGENT_HOST_STATE_KEY = "polychatAgentHost";

export interface AgentHostState {
  apiServerKey: string;
  apiKey: string;
  modelTier: ModelTier;
  checkpointReference?: string;
  lastCheckpointedRunId?: string;
}

export class AgentHost extends Sandbox<Env> {
  enableInternet = false;
  interceptHttps = true;
  sleepAfter = AGENT_HOST_SLEEP_AFTER;

  async readAgentHostState(): Promise<AgentHostState | null> {
    return (await this.ctx.storage.get<AgentHostState>(AGENT_HOST_STATE_KEY)) ?? null;
  }

  async writeAgentHostState(state: AgentHostState): Promise<void> {
    await this.ctx.storage.put(AGENT_HOST_STATE_KEY, state);
  }

  async clearAgentHostState(): Promise<void> {
    await this.ctx.storage.delete(AGENT_HOST_STATE_KEY);
  }
}

AgentHost.outboundHandlers = {
  [POLYCHAT_MODELS_HANDLER]: polychatModelsOutbound,
  [AGENT_HOST_EGRESS_HANDLER]: agentHostEgressOutbound,
};
