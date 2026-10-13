import type { ContainerEgressProps } from "agents/harness/container";
import { WorkerEntrypoint } from "cloudflare:workers";

import type { Env } from "../types";
import { HERMES_MODEL_HOST } from "./hermes";

export interface HermesModelEgressProps extends ContainerEgressProps {
  hostId: string;
}

export class HermesModelEgress extends WorkerEntrypoint<Env, HermesModelEgressProps> {
  async fetch(request: Request): Promise<Response> {
    if (new URL(request.url).hostname !== HERMES_MODEL_HOST) {
      return new Response("Hermes may only reach the Polychat model port", { status: 403 });
    }

    return this.env.HERMES_AGENT.get(
      this.env.HERMES_AGENT.idFromString(this.ctx.props.hostId),
    ).forwardModelRequest({
      path: new URL(request.url).pathname,
      method: request.method,
      headers: [...request.headers],
      body: request.body ? await request.arrayBuffer() : null,
    });
  }
}
