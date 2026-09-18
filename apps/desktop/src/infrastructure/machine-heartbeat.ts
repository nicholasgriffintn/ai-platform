import { apiService } from "@ngriffin_uk/polychat-library-client";
import {
  AGENT_RUNTIME_VENDORS,
  machineHeartbeatSchema,
  type MachineHeartbeat,
  type MachineRecord,
  type DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";

import {
  tauriDesktopBackend,
  type ConnectedDesktopBackend,
  type DesktopDiagnostics,
} from "./desktop-backend";

export const MACHINE_HEARTBEAT_INTERVAL_MS = 2 * 60_000;

function checkedAt(): string {
  return new Date().toISOString();
}

async function inspectAgentRuntime(
  backend: ConnectedDesktopBackend,
  vendor: (typeof AGENT_RUNTIME_VENDORS)[number],
) {
  const readiness = await backend.probeAgentTool(vendor).catch(() => ({
    state: "missing" as const,
    checkedAt: checkedAt(),
  }));
  const supportsSessions =
    readiness.state === "ready"
      ? await backend.agentSupportsSessions(vendor).catch(() => false)
      : false;

  return {
    kind: "agent" as const,
    vendor,
    readiness,
    supportsSessions,
  };
}

function advertisedReadiness(readiness: DesktopRuntimeReadiness): DesktopRuntimeReadiness {
  if (readiness.status === "ready") {
    return {
      status: "ready",
      checkedAt: readiness.checkedAt,
      version: readiness.version,
    };
  }

  return {
    status: readiness.status,
    checkedAt: readiness.checkedAt,
    detail: null,
  };
}

async function inspectRuntime(
  backend: ConnectedDesktopBackend,
  endpoint: Awaited<ReturnType<ConnectedDesktopBackend["listEndpoints"]>>[number],
) {
  let readiness: DesktopRuntimeReadiness;

  try {
    readiness = await backend.probeEndpoint(endpoint);
  } catch {
    readiness = {
      status: "unreachable",
      checkedAt: checkedAt(),
      detail: null,
    };
  }

  const models =
    readiness.status === "ready" ? await backend.discoverModels(endpoint.id).catch(() => []) : [];

  return {
    kind: "model" as const,
    vendor: endpoint.vendor,
    readiness: advertisedReadiness(readiness),
    models: models.map((model) => ({
      nativeId: model.nativeId,
      displayName: model.displayName,
      contextTokens: model.contextTokens,
      parameterSizeBytes: model.parameterSizeBytes,
      capabilities: model.capabilities,
      loaded: model.loaded,
    })),
  };
}

export async function buildMachineHeartbeatPayload(
  backend: ConnectedDesktopBackend,
  diagnostics: DesktopDiagnostics,
): Promise<MachineHeartbeat> {
  const endpoints = await backend.listEndpoints();
  const modelEndpoints = endpoints.filter((endpoint) => endpoint.kind === "model");
  const modelRuntimes = await Promise.all(
    modelEndpoints.map((endpoint) => inspectRuntime(backend, endpoint)),
  );
  const agentRuntimes = await Promise.all(
    AGENT_RUNTIME_VENDORS.map((vendor) => inspectAgentRuntime(backend, vendor)),
  );
  const hasAgentRuntime = agentRuntimes.some(
    (runtime) => runtime.readiness.state === "ready" && runtime.supportsSessions,
  );

  return machineHeartbeatSchema.parse({
    machineId: diagnostics.machineId,
    label: `Polychat Desktop (${diagnostics.platform})`,
    platform: diagnostics.platform,
    appVersion: diagnostics.appVersion,
    runtimes: [...modelRuntimes, ...agentRuntimes],
    capabilities: [
      ...(modelEndpoints.length > 0 ? (["model-run", "model-relay"] as const) : []),
      ...(hasAgentRuntime ? (["agent-run"] as const) : []),
    ],
  });
}

export interface MachineHeartbeatScheduler {
  start(): void;
  trigger(): void;
  stop(): void;
}

export function createMachineHeartbeatScheduler(options: {
  heartbeat: () => Promise<unknown>;
  intervalMs?: number;
  onError?: (error: unknown) => void;
}): MachineHeartbeatScheduler {
  const intervalMs = options.intervalMs ?? MACHINE_HEARTBEAT_INTERVAL_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let active: Promise<void> | null = null;
  let pending = false;

  const schedule = () => {
    if (running) {
      timer = setTimeout(() => void run(), intervalMs);
    }
  };

  const run = async () => {
    if (!running) {
      return;
    }

    if (active) {
      pending = true;

      return;
    }

    active = Promise.resolve()
      .then(() => options.heartbeat())
      .then(() => undefined)
      .catch((error) => {
        options.onError?.(error);
      });

    try {
      await active;
    } finally {
      active = null;

      if (running) {
        if (pending) {
          pending = false;
          void run();
        } else {
          schedule();
        }
      }
    }
  };

  return {
    start() {
      if (running) {
        return;
      }

      running = true;
      void run();
    },
    trigger() {
      if (!running) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }

      void run();
    },
    stop() {
      running = false;
      pending = false;

      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export async function advertiseCurrentMachine(): Promise<MachineRecord | null> {
  const diagnostics = await tauriDesktopBackend.collectDiagnostics();
  const payload = await buildMachineHeartbeatPayload(tauriDesktopBackend, diagnostics);

  return apiService.heartbeatMachine(payload);
}

export async function removeMachineAdvertisement(): Promise<void> {
  const diagnostics = await tauriDesktopBackend.collectDiagnostics();

  await apiService.forgetMachine(diagnostics.machineId);
}
