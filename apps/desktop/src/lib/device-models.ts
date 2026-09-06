import { buildDeviceModels, setDeviceModelSource } from "@ngriffin_uk/polychat-library-chat";
import type { ModelConfig } from "@ngriffin_uk/polychat-schemas";

import { tauriDesktopBackend } from "./desktop-backend";

export async function discoverDeviceModels(): Promise<ModelConfig> {
  const endpoints = await tauriDesktopBackend.listEndpoints();
  const runtimes = endpoints.filter((endpoint) => endpoint.kind === "model");

  const discovered = await Promise.all(
    runtimes.map(async (endpoint) => ({
      vendor: endpoint.vendor,
      models: await tauriDesktopBackend.discoverModels(endpoint.id).catch(() => []),
    })),
  );

  return buildDeviceModels(discovered);
}

setDeviceModelSource(discoverDeviceModels);
