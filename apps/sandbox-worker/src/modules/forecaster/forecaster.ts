import { waitForContainerPort } from "@ngriffin_uk/polychat-library-sandbox";
import { DurableObject } from "cloudflare:workers";

import type { Env } from "../../types";
import {
  FORECASTER_INACTIVITY_TIMEOUT_MS,
  FORECASTER_INSTANCE_TYPE,
  FORECASTER_PORT,
  FORECASTER_READY_TIMEOUT_MS,
  FORECASTER_REQUEST_TIMEOUT_MS,
} from "./config";

export interface ForecasterReply {
  status: number;
  body: string;
}

export class Forecaster extends DurableObject<Env> {
  private get container(): Container {
    const container = this.ctx.container;

    if (!container) {
      throw new Error("The container binding is not configured");
    }

    return container;
  }

  private async ensureReady(): Promise<void> {
    if (!this.container.running) {
      this.container.start({
        image: this.container.images.forecaster,
        enableInternet: false,
        instance: FORECASTER_INSTANCE_TYPE,
      });
      await this.container.setInactivityTimeout(FORECASTER_INACTIVITY_TIMEOUT_MS);
    }

    await waitForContainerPort(this.container, FORECASTER_PORT, {
      path: "/health",
      expectedStatus: { min: 200, max: 200 },
      timeoutMs: FORECASTER_READY_TIMEOUT_MS,
    });
  }

  async forecast(body: string): Promise<ForecasterReply> {
    await this.ensureReady();

    const response = await this.container
      .getTcpPort(FORECASTER_PORT)
      .fetch("http://container/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(FORECASTER_REQUEST_TIMEOUT_MS),
      });

    return { status: response.status, body: await response.text() };
  }
}
