import type { ComputeSite, DesktopEndpoint, ModelConfig } from "@ngriffin_uk/polychat-schemas";

export interface ModelRuntimeOption {
  site: ComputeSite;
  machineId?: string;
  label: string;
}

export function buildModelRuntimeOptions(
  models: ModelConfig,
  endpoints: DesktopEndpoint[] = [],
  machines: readonly { machineId: string; label: string }[] = [],
  includeBrowser = true,
): ModelRuntimeOption[] {
  const options: ModelRuntimeOption[] = [
    { site: "hosted", label: "Polychat" },
    ...(includeBrowser ? [{ site: "browser" as const, label: "Browser" }] : []),
  ];

  if (
    endpoints.some((endpoint) => endpoint.kind === "model" && endpoint.transport === "loopback")
  ) {
    options.push({ site: "device", label: "This device" });
  }

  for (const model of Object.values(models)) {
    if (model.machineId && !options.some((option) => option.machineId === model.machineId)) {
      options.push({
        site: "machine",
        machineId: model.machineId,
        label:
          machines.find((machine) => machine.machineId === model.machineId)?.label ??
          model.machineId,
      });
    }
  }

  return options;
}
