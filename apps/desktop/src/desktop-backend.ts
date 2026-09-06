import type { DesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import {
  desktopEndpointSchema,
  desktopRuntimeReadinessSchema,
} from "@ngriffin_uk/polychat-schemas";
import { invoke } from "@tauri-apps/api/core";

export type ConnectedDesktopBackend = Pick<DesktopBackend, "listEndpoints" | "probeEndpoint">;

export const tauriDesktopBackend: ConnectedDesktopBackend = {
  listEndpoints: async () => desktopEndpointSchema.array().parse(await invoke("list_endpoints")),
  probeEndpoint: async (endpointId) =>
    desktopRuntimeReadinessSchema.parse(await invoke("probe_endpoint", { endpointId })),
};
