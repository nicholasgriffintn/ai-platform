import { desktopExecutionBackend, type DesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import type {
  ComputeSite,
  DesktopEndpoint,
  DesktopRuntimeReadiness,
  ModelConfig,
  Readiness,
} from "@ngriffin_uk/polychat-schemas";
import { getModelsByMode } from "@ngriffin_uk/polychat-schemas";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

export const MODEL_RUNTIME_OPTIONS_QUERY_KEY = "model-runtime-options";

export interface ModelRuntimeOption {
  site: ComputeSite;
  machineId?: string;
  label: string;
  detail?: string;
  readiness: Readiness;
}

interface RuntimeProbe {
  endpoint: DesktopEndpoint;
  readiness: DesktopRuntimeReadiness;
  modelCount: number;
}

const READINESS_TTL_MS = 60_000;
const OFFLINE_AFTER_MS = 5 * 60_000;

function createReadiness(
  state: Readiness["state"],
  reasonCode: Readiness["reasonCode"],
  reason: string,
  action?: Readiness["action"],
  now = new Date(),
): Readiness {
  const checkedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + READINESS_TTL_MS).toISOString();

  return {
    protocolVersion: 1,
    state,
    reasonCode,
    reason,
    checkedAt,
    expiresAt,
    ...(action ? { action } : {}),
  };
}

function getVendorLabel(endpoint: DesktopEndpoint): string {
  if (endpoint.kind !== "model") {
    return endpoint.label;
  }

  return endpoint.vendor === "ollama"
    ? "Ollama"
    : endpoint.vendor === "lmstudio"
      ? "LM Studio"
      : endpoint.label;
}

function formatLastSeen(lastSeenAt: string, now: Date): string {
  const elapsedMs = Math.max(0, now.getTime() - Date.parse(lastSeenAt));
  const elapsedMinutes = Math.floor(elapsedMs / 60_000);

  if (elapsedMinutes < 1) {
    return "Last seen just now";
  }

  if (elapsedMinutes < 60) {
    return `Last seen ${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `Last seen ${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);

  return `Last seen ${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
}

function isOffline(endpoint: DesktopEndpoint, readiness: DesktopRuntimeReadiness, now: Date) {
  return (
    endpoint.transport === "network" &&
    readiness.status === "unreachable" &&
    endpoint.lastSeenAt !== null &&
    now.getTime() - Date.parse(endpoint.lastSeenAt) >= OFFLINE_AFTER_MS
  );
}

function toEndpointOption(
  probe: RuntimeProbe,
  site: "device" | "machine",
  now: Date,
  fallbackModelCount: number,
): ModelRuntimeOption {
  const { endpoint, readiness } = probe;
  const label = site === "device" ? "This Mac" : endpoint.label;
  const modelCount = probe.modelCount || fallbackModelCount;

  if (readiness.status === "ready") {
    return {
      site,
      ...(site === "machine" ? { machineId: endpoint.id } : {}),
      label,
      detail: `${modelCount} model${modelCount === 1 ? "" : "s"}`,
      readiness: createReadiness("ready", "ready", "Ready", undefined, now),
    };
  }

  if (site === "machine" && endpoint.lastSeenAt && isOffline(endpoint, readiness, now)) {
    return {
      site,
      machineId: endpoint.id,
      label,
      detail: formatLastSeen(endpoint.lastSeenAt, now),
      readiness: createReadiness(
        "unknown",
        "machine_offline",
        `${label} is offline`,
        undefined,
        now,
      ),
    };
  }

  if (readiness.status === "unauthorised") {
    return {
      site,
      ...(site === "machine" ? { machineId: endpoint.id } : {}),
      label,
      detail: `${getVendorLabel(endpoint)} needs permission`,
      readiness: createReadiness(
        "unavailable",
        "permission_denied",
        `${getVendorLabel(endpoint)} needs permission`,
        {
          kind: "open_runtimes",
          label: "Set up",
        },
        now,
      ),
    };
  }

  return {
    site,
    ...(site === "machine" ? { machineId: endpoint.id } : {}),
    label,
    detail: `${getVendorLabel(endpoint)} is not running`,
    readiness: createReadiness(
      "unavailable",
      "runtime_unreachable",
      `${getVendorLabel(endpoint)} is not running`,
      {
        kind: "retry",
        label: "Check again",
      },
      now,
    ),
  };
}

function getDeviceOption(
  models: ModelConfig,
  probes: RuntimeProbe[] | undefined,
  hasDesktopBackend: boolean,
  probeFailed: boolean,
  now: Date,
): ModelRuntimeOption {
  if (!hasDesktopBackend) {
    return {
      site: "device",
      label: "This Mac",
      detail: "Needs the desktop app",
      readiness: createReadiness(
        "unavailable",
        "desktop_required",
        "Needs the desktop app",
        {
          kind: "install_desktop",
          label: "Get the desktop app",
        },
        now,
      ),
    };
  }

  if (!probes && !probeFailed) {
    return {
      site: "device",
      label: "This Mac",
      detail: "Checking runtimes…",
      readiness: createReadiness(
        "unknown",
        "runtime_model_loading",
        "Checking runtimes…",
        undefined,
        now,
      ),
    };
  }

  const localProbes = (probes ?? []).filter((probe) => probe.endpoint.transport === "loopback");

  if (localProbes.length === 0) {
    return {
      site: "device",
      label: "This Mac",
      detail: "Ollama is not set up",
      readiness: createReadiness(
        "setup_required",
        "runtime_not_configured",
        "Ollama is not set up",
        {
          kind: "open_runtimes",
          label: "Set up",
        },
        now,
      ),
    };
  }

  const readyProbes = localProbes.filter((probe) => probe.readiness.status === "ready");
  const deviceModelCount = Object.keys(getModelsByMode(models, "device")).length;

  if (readyProbes.length > 0) {
    const modelCount =
      readyProbes.reduce((count, probe) => count + probe.modelCount, 0) || deviceModelCount;

    return {
      site: "device",
      label: "This Mac",
      detail: `${modelCount} model${modelCount === 1 ? "" : "s"}`,
      readiness: createReadiness("ready", "ready", "Ready", undefined, now),
    };
  }

  return toEndpointOption(localProbes[0], "device", now, deviceModelCount);
}

function getMachineOptions(
  models: ModelConfig,
  probes: RuntimeProbe[] | undefined,
  hasDesktopBackend: boolean,
  probeFailed: boolean,
  now: Date,
): ModelRuntimeOption[] {
  if (!hasDesktopBackend) {
    return [
      {
        site: "machine",
        label: "Studio Mac",
        detail: "Needs the desktop app",
        readiness: createReadiness(
          "unavailable",
          "desktop_required",
          "Needs the desktop app",
          {
            kind: "install_desktop",
            label: "Get the desktop app",
          },
          now,
        ),
      },
    ];
  }

  if (!probes && !probeFailed) {
    return [
      {
        site: "machine",
        label: "Studio Mac",
        detail: "Checking runtimes…",
        readiness: createReadiness(
          "unknown",
          "runtime_model_loading",
          "Checking runtimes…",
          undefined,
          now,
        ),
      },
    ];
  }

  const machineProbes = (probes ?? []).filter((probe) => probe.endpoint.transport === "network");

  if (machineProbes.length === 0) {
    return [
      {
        site: "machine",
        label: "Studio Mac",
        detail: "No machine is connected",
        readiness: createReadiness(
          "setup_required",
          "runtime_not_configured",
          "No machine is connected",
          {
            kind: "open_runtimes",
            label: "Set up",
          },
          now,
        ),
      },
    ];
  }

  return machineProbes.map((probe) => {
    const machineModels = Object.values(models).filter(
      (model) => model.machineId === probe.endpoint.id,
    );

    return toEndpointOption(probe, "machine", now, machineModels.length);
  });
}

export function buildModelRuntimeOptions(
  models: ModelConfig,
  probes: RuntimeProbe[] | undefined,
  hasDesktopBackend: boolean,
  probeFailed = false,
  now = new Date(),
): ModelRuntimeOption[] {
  const hostedModels = getModelsByMode(models, "hosted");
  const browserModels = getModelsByMode(models, "browser");
  const browserModelCount = Object.keys(browserModels).length;

  return [
    {
      site: "hosted",
      label: "Polychat",
      detail: `${Object.keys(hostedModels).length} models`,
      readiness: createReadiness("ready", "ready", "Ready", undefined, now),
    },
    {
      site: "browser",
      label: "Browser",
      detail: browserModelCount > 0 ? `${browserModelCount} models` : "Browser models are loading",
      readiness: createReadiness(
        browserModelCount > 0 ? "ready" : "unknown",
        browserModelCount > 0 ? "ready" : "runtime_model_loading",
        browserModelCount > 0 ? "Ready" : "Browser models are loading",
        undefined,
        now,
      ),
    },
    getDeviceOption(models, probes, hasDesktopBackend, probeFailed, now),
    ...getMachineOptions(models, probes, hasDesktopBackend, probeFailed, now),
  ];
}

async function fetchRuntimeProbes(backend: DesktopBackend): Promise<RuntimeProbe[]> {
  const endpoints = (await backend.listEndpoints()).filter((endpoint) => endpoint.kind === "model");

  return Promise.all(
    endpoints.map(async (endpoint) => {
      let readiness: DesktopRuntimeReadiness;

      try {
        readiness = await backend.probeEndpoint(endpoint);
      } catch {
        readiness = {
          status: "unreachable",
          checkedAt: new Date().toISOString(),
          detail: null,
        };
      }

      if (readiness.status !== "ready") {
        return { endpoint, readiness, modelCount: 0 };
      }

      try {
        const models = await backend.discoverModels(endpoint.id);

        return { endpoint, readiness, modelCount: models.length };
      } catch {
        return { endpoint, readiness, modelCount: 0 };
      }
    }),
  );
}

export function useModelRuntimeOptions(models: ModelConfig) {
  const backend = desktopExecutionBackend();
  const runtimeQuery = useQuery({
    queryKey: [MODEL_RUNTIME_OPTIONS_QUERY_KEY],
    queryFn: () => (backend ? fetchRuntimeProbes(backend) : Promise.resolve([])),
    enabled: Boolean(backend),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const options = useMemo(
    () =>
      buildModelRuntimeOptions(models, runtimeQuery.data, Boolean(backend), runtimeQuery.isError),
    [backend, models, runtimeQuery.data, runtimeQuery.isError],
  );

  return {
    options,
    isLoading: runtimeQuery.isLoading,
    isFetching: runtimeQuery.isFetching,
    refresh: runtimeQuery.refetch,
  };
}
