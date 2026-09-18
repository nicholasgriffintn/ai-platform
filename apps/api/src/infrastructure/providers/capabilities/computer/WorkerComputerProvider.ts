import {
  teammateComputerTeachingRecordingSchema,
  type TeammateComputerInput,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { IEnv } from "~/types";

import type { ComputerProvider, ComputerResource, ComputerScreenConnection } from "./types";
import { STALE_COMPUTER_LEASE_ERROR_CODE } from "./types";

export class WorkerComputerProvider implements ComputerProvider {
  constructor(private readonly worker: NonNullable<IEnv["COMPUTER_WORKER"]>) {}

  private async request(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.worker.fetch(`https://computer.internal${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const message =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Computer provider failed (${response.status})`;
      const staleLease = isRecord(payload) && payload.code === "stale_lease";

      throw new AssistantError(
        message,
        staleLease ? ErrorType.CONFLICT_ERROR : ErrorType.PROVIDER_ERROR,
        staleLease ? 409 : 502,
        staleLease ? { code: STALE_COMPUTER_LEASE_ERROR_CODE } : {},
      );
    }

    const payload = await response.json();

    if (!isRecord(payload)) {
      throw new AssistantError("Computer provider returned invalid data", ErrorType.PROVIDER_ERROR);
    }

    return payload;
  }

  async provision(input: {
    resourceId: string;
    checkpointReference?: string | null;
  }): Promise<ComputerResource> {
    const payload = await this.request("/computer/provision", input);

    if (typeof payload.handle !== "string") {
      throw new AssistantError(
        "Computer provider did not return a handle",
        ErrorType.PROVIDER_ERROR,
      );
    }

    return {
      handle: payload.handle,
      checkpointReference:
        typeof payload.checkpointReference === "string" ? payload.checkpointReference : null,
    };
  }

  async observe(input: { resourceId: string; handle: string; fence: number }) {
    return this.request("/computer/observe", input);
  }

  async input(input: {
    resourceId: string;
    handle: string;
    fence: number;
    input: TeammateComputerInput;
  }) {
    return this.request("/computer/input", input);
  }

  async connectScreen(input: {
    resourceId: string;
    handle: string;
    fence: number;
    recordingId?: string;
  }): Promise<ComputerScreenConnection> {
    const payload = await this.request("/computer/screen", input);

    if (typeof payload.screenUrl !== "string" || typeof payload.expiresAt !== "string") {
      throw new AssistantError("Computer screen connection is invalid", ErrorType.PROVIDER_ERROR);
    }

    return { screenUrl: payload.screenUrl, expiresAt: payload.expiresAt };
  }

  async connectViewScreen(input: {
    resourceId: string;
    handle: string;
  }): Promise<ComputerScreenConnection> {
    const payload = await this.request("/computer/view-screen", input);

    if (typeof payload.screenUrl !== "string" || typeof payload.expiresAt !== "string") {
      throw new AssistantError("Computer screen connection is invalid", ErrorType.PROVIDER_ERROR);
    }

    return { screenUrl: payload.screenUrl, expiresAt: payload.expiresAt };
  }

  async getTeachingRecording(input: {
    resourceId: string;
    handle: string;
    fence: number;
    recordingId: string;
  }) {
    const payload = await this.request("/computer/teaching-recording", input);
    const recording = teammateComputerTeachingRecordingSchema.safeParse(payload);

    if (!recording.success) {
      throw new AssistantError("Teaching recording is invalid", ErrorType.PROVIDER_ERROR);
    }

    return recording.data;
  }

  async revokeControl(input: { resourceId: string; handle: string; fence: number }) {
    await this.request("/computer/revoke-control", input);
  }

  async checkpoint(input: { resourceId: string; handle: string; fence: number }) {
    const payload = await this.request("/computer/checkpoint", input);

    if (typeof payload.checkpointReference !== "string") {
      throw new AssistantError("Computer checkpoint is invalid", ErrorType.PROVIDER_ERROR);
    }

    return { checkpointReference: payload.checkpointReference };
  }

  async restore(input: {
    resourceId: string;
    handle: string;
    checkpointReference: string;
    fence: number;
  }) {
    await this.request("/computer/restore", input);
  }

  async stop(input: { resourceId: string; handle: string; fence: number }) {
    await this.request("/computer/stop", input);
  }

  async destroy(input: { resourceId: string; handle: string; fence: number }) {
    await this.request("/computer/destroy", input);
  }
}
