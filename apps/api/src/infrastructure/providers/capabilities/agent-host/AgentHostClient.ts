import {
  AGENT_HOST_UNPROVISIONED_CODE,
  agentHostRunSnapshotSchema,
  type AgentHostApprovalRequest,
  type AgentHostProvisionRequest,
  type AgentHostRunReference,
  type AgentHostRunRequest,
  type AgentHostRunSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

import { AgentHostUnprovisionedError } from "./AgentHostUnprovisionedError";

export class AgentHostClient {
  constructor(private readonly worker: NonNullable<IEnv["COMPUTER_WORKER"]>) {}

  private async request(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.worker.fetch(`https://computer.internal/agent-host/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (
      response.status === 409 &&
      isRecord(payload) &&
      payload.code === AGENT_HOST_UNPROVISIONED_CODE
    ) {
      throw new AgentHostUnprovisionedError();
    }

    if (!response.ok) {
      throw new AssistantError(
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Hosted agent request failed (${response.status})`,
        ErrorType.PROVIDER_ERROR,
        502,
      );
    }

    return payload;
  }

  async provision(input: AgentHostProvisionRequest): Promise<void> {
    await this.request("provision", input);
  }

  async destroy(hostId: string): Promise<void> {
    await this.request("destroy", { hostId });
  }

  async startRun(input: AgentHostRunRequest): Promise<string> {
    const payload = await this.request("run", input);

    if (!isRecord(payload) || typeof payload.runId !== "string") {
      throw new AssistantError("Hosted agent did not start a run", ErrorType.PROVIDER_ERROR);
    }

    return payload.runId;
  }

  async readRun(input: AgentHostRunReference): Promise<AgentHostRunSnapshot> {
    const snapshot = agentHostRunSnapshotSchema.safeParse(await this.request("run-status", input));

    if (!snapshot.success) {
      throw new AssistantError("Hosted agent returned an unreadable run", ErrorType.PROVIDER_ERROR);
    }

    return snapshot.data;
  }

  async answerApproval(input: AgentHostApprovalRequest): Promise<void> {
    await this.request("run-approval", input);
  }

  async stopRun(input: AgentHostRunReference): Promise<void> {
    await this.request("run-stop", input);
  }
}
