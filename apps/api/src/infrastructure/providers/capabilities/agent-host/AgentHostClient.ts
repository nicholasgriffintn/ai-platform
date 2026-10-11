import {
  agentHostCheckpointResponseSchema,
  agentHostHealthResponseSchema,
  agentHostRunSnapshotSchema,
  agentHostSteerResponseSchema,
  type AgentHostApprovalRequest,
  type AgentHostCheckpointRequest,
  type AgentHostDeprovisionRequest,
  type AgentHostProvisionRequest,
  type AgentHostRunReference,
  type AgentHostRunRequest,
  type AgentHostRunSnapshot,
  type AgentHostSteerRequest,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

export class AgentHostClient {
  constructor(private readonly worker: NonNullable<IEnv["AGENT_WORKER"]>) {}

  private async request(path: string, body: Record<string, unknown>): Promise<unknown> {
    const response = await this.worker.fetch(`https://agent.internal/agent-host/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Hosted agent request failed (${response.status})`;

      if (response.status === 429) {
        throw new AssistantError(message, ErrorType.RATE_LIMIT_ERROR, 429);
      }

      if (response.status >= 400 && response.status < 500) {
        throw new AssistantError(
          message,
          response.status === 409 ? ErrorType.CONFLICT_ERROR : ErrorType.PARAMS_ERROR,
          response.status,
        );
      }

      throw new AssistantError(message, ErrorType.PROVIDER_ERROR, 502);
    }

    return payload;
  }

  async openRunEvents(input: AgentHostRunReference): Promise<Response> {
    const response = await this.worker.fetch(`https://agent.internal/agent-host/run-events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!response.ok || !response.body) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Hosted agent run events are unavailable (${response.status})`;

      throw new AssistantError(message, ErrorType.PROVIDER_ERROR, 502);
    }

    return response;
  }

  async provision(input: AgentHostProvisionRequest): Promise<void> {
    await this.request("provision", input);
  }

  async deprovision(input: AgentHostDeprovisionRequest): Promise<void> {
    await this.request("deprovision", input);
  }

  async checkpoint(input: AgentHostCheckpointRequest): Promise<string | null> {
    const payload = await this.request("checkpoint", input);
    const parsed = agentHostCheckpointResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AssistantError(
        "Hosted agent returned an unreadable checkpoint",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return parsed.data.checkpointReference;
  }

  async health(hostId: string): Promise<{ provisioned: boolean; gateway: string }> {
    const payload = await this.request("health", { hostId });
    const parsed = agentHostHealthResponseSchema.safeParse(payload);

    if (!parsed.success) {
      throw new AssistantError(
        "Hosted agent returned an unreadable health status",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return parsed.data;
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

  async steerRun(input: AgentHostSteerRequest): Promise<void> {
    const payload = agentHostSteerResponseSchema.safeParse(await this.request("run-steer", input));

    if (!payload.success || payload.data.accepted !== true) {
      throw new AssistantError(
        "The hosted run did not accept the steer text",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }

  async stopRun(input: AgentHostRunReference): Promise<void> {
    await this.request("run-stop", input);
  }
}
