import type { DesktopBackend, DesktopRun } from "@ngriffin_uk/polychat-library-chat";
import {
  desktopEndpointSchema,
  desktopRuntimeReadinessSchema,
  desktopStreamEventSchema,
  discoveredModelSchema,
  type DesktopModelRunRequest,
  type DesktopStreamEvent,
} from "@ngriffin_uk/polychat-schemas";
import { createAsyncEventQueue } from "@ngriffin_uk/polychat-utility-core";
import { Channel, invoke } from "@tauri-apps/api/core";

export type ConnectedDesktopBackend = Pick<
  DesktopBackend,
  "listEndpoints" | "probeEndpoint" | "discoverModels" | "startModelRun"
>;

export const tauriDesktopBackend: ConnectedDesktopBackend = {
  listEndpoints: async () => desktopEndpointSchema.array().parse(await invoke("list_endpoints")),
  probeEndpoint: async (endpointId) =>
    desktopRuntimeReadinessSchema.parse(await invoke("probe_endpoint", { endpointId })),
  discoverModels: async (endpointId) =>
    discoveredModelSchema.array().parse(await invoke("discover_models", { endpointId })),
  startModelRun: async (request: DesktopModelRunRequest): Promise<DesktopRun> => {
    const runId = globalThis.crypto.randomUUID();
    const queue = createAsyncEventQueue<DesktopStreamEvent>();
    const channel = new Channel();

    channel.onmessage = (raw) => {
      const event = desktopStreamEventSchema.parse(raw);

      queue.push(event);

      if (event.type === "finished" || event.type === "failed") {
        queue.close();
      }
    };

    void invoke("start_model_run", { runId, request, onEvent: channel }).catch(() => queue.close());

    return {
      runId,
      cancel: () => {
        void invoke("cancel_model_run", { runId });
      },
      events: queue.events,
    };
  },
};
