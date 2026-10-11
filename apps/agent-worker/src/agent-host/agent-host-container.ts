import { Sandbox } from "@cloudflare/sandbox";

import {
  AGENT_HOST_EGRESS_HANDLER,
  AGENT_HOST_SLEEP_AFTER,
  POLYCHAT_API_HANDLER,
} from "../config/agent-host";
import type { Env } from "../types";
import { agentHostEgressOutbound, polychatApiOutbound } from "./outbound";

const AGENT_HOST_STATE_KEY = "polychatAgentHost";

export interface AgentHostState {
  apiServerKey: string;
  apiKey: string;
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
}

AgentHost.outboundHandlers = {
  [POLYCHAT_API_HANDLER]: polychatApiOutbound,
  [AGENT_HOST_EGRESS_HANDLER]: agentHostEgressOutbound,
};
