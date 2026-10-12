import { Sandbox as BaseSandbox } from "@cloudflare/sandbox";

import type { Env } from "../../../types";
import {
  BROKERED_GIT_HANDLER,
  brokeredGitOutbound,
  EGRESS_POLICY_HANDLER,
  egressPolicyOutbound,
} from "./network-egress";

const BLOCKED_EGRESS_STORAGE_KEY = "polychatBlockedEgress";
const MAX_RECORDED_BLOCKED_HOSTS = 20;

export class Sandbox extends BaseSandbox<Env> {
  enableInternet = false;
  interceptHttps = true;

  async recordBlockedEgress(host: string): Promise<void> {
    const hosts = (await this.ctx.storage.get<string[]>(BLOCKED_EGRESS_STORAGE_KEY)) ?? [];

    if (hosts.includes(host) || hosts.length >= MAX_RECORDED_BLOCKED_HOSTS) {
      return;
    }

    await this.ctx.storage.put(BLOCKED_EGRESS_STORAGE_KEY, [...hosts, host]);
  }

  async takeBlockedEgress(): Promise<string[]> {
    const hosts = (await this.ctx.storage.get<string[]>(BLOCKED_EGRESS_STORAGE_KEY)) ?? [];

    await this.ctx.storage.delete(BLOCKED_EGRESS_STORAGE_KEY);

    return hosts;
  }
}

Sandbox.outboundHandlers = {
  [EGRESS_POLICY_HANDLER]: egressPolicyOutbound,
  [BROKERED_GIT_HANDLER]: brokeredGitOutbound,
};
