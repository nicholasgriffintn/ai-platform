import type {
  AgentHarnessAbortRequest,
  AgentHarnessAnswerRequest,
  AgentHarnessRpc,
  AgentHarnessTurnRequest,
  HostedAgentHarnessId,
} from "@ngriffin_uk/polychat-schemas";
import { WorkerEntrypoint } from "cloudflare:workers";

import type { Env } from "./types";

export default class AgentWorker extends WorkerEntrypoint<Env> implements AgentHarnessRpc {
  private host(harness: HostedAgentHarnessId, sessionKey: string) {
    switch (harness) {
      case "pi":
        return this.env.PI_AGENT.getByName(sessionKey);
      case "opencode":
        return this.env.OPENCODE_AGENT.getByName(sessionKey);
      default:
        return this.env.HERMES_AGENT.getByName(sessionKey);
    }
  }

  async fetch(): Promise<Response> {
    return new Response("Not found", { status: 404 });
  }

  async submitHarnessTurn(harness: HostedAgentHarnessId, request: AgentHarnessTurnRequest) {
    return this.host(harness, request.sessionKey).submit(request);
  }

  async readHarnessEvents(harness: HostedAgentHarnessId, sessionKey: string, after: number) {
    return this.host(harness, sessionKey).events(after);
  }

  async answerHarnessApproval(harness: HostedAgentHarnessId, request: AgentHarnessAnswerRequest) {
    return this.host(harness, request.sessionKey).answer(request);
  }

  async abortHarnessTurn(harness: HostedAgentHarnessId, request: AgentHarnessAbortRequest) {
    await this.host(harness, request.sessionKey).abort(request.operationId);
  }
}

export { HermesAgent } from "./harness/hermes";
export { HermesModelEgress } from "./harness/model-egress";
export { OpenCodeAgent } from "./harness/opencode";
export { PiAgent } from "./harness/pi";
