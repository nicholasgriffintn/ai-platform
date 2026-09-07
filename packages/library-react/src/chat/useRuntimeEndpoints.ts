import { desktopExecutionBackend, type DesktopBackend } from "@ngriffin_uk/polychat-library-chat";
import type {
  DesktopEndpoint,
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";
import { desktopEndpointSchema } from "@ngriffin_uk/polychat-schemas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DEVICE_MODELS_QUERY_KEY } from "./useDeviceModels.js";

export const RUNTIME_ENDPOINTS_QUERY_KEY = "runtime-endpoints";

export interface RuntimeEndpointConnectionResult {
  ok: boolean;
  readiness: DesktopRuntimeReadiness;
}

function requireDesktopBackend(): DesktopBackend {
  const backend = desktopExecutionBackend();

  if (!backend) {
    throw new Error("Runtime settings are only available in the desktop application.");
  }

  return backend;
}

export function buildDesktopEndpoint(candidate: DesktopEndpointCandidate): {
  endpoint: DesktopEndpoint;
  pairingSecret?: string;
} {
  const pairingSecret = candidate.pairingSecret?.trim() || undefined;
  const parsed = desktopEndpointSchema.safeParse({
    ...candidate,
    pairingSecretStored: Boolean(pairingSecret),
    approvedAt: new Date().toISOString(),
    lastSeenAt: null,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The runtime address is not valid.");
  }

  return { endpoint: parsed.data, pairingSecret };
}

async function invalidateRuntimeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: [RUNTIME_ENDPOINTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [DEVICE_MODELS_QUERY_KEY] }),
  ]);
}

export function useRuntimeEndpoints() {
  const backend = desktopExecutionBackend();
  const queryClient = useQueryClient();
  const endpointsQuery = useQuery({
    queryKey: [RUNTIME_ENDPOINTS_QUERY_KEY],
    queryFn: () => backend?.listEndpoints() ?? Promise.resolve([]),
    enabled: Boolean(backend),
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });

  const connect = useMutation<RuntimeEndpointConnectionResult, Error, DesktopEndpointCandidate>({
    mutationFn: async (candidate) => {
      const { endpoint, pairingSecret } = buildDesktopEndpoint(candidate);
      const readiness = await requireDesktopBackend().probeEndpoint(endpoint, pairingSecret);

      if (readiness.status !== "ready") {
        return { ok: false, readiness };
      }

      await requireDesktopBackend().saveEndpoint(
        { ...endpoint, lastSeenAt: readiness.checkedAt },
        pairingSecret,
      );
      await invalidateRuntimeQueries(queryClient);

      return { ok: true, readiness };
    },
  });

  const probe = useMutation<DesktopRuntimeReadiness, Error, DesktopEndpoint>({
    mutationFn: async (endpoint) => {
      const readiness = await requireDesktopBackend().probeEndpoint(endpoint);

      if (readiness.status === "ready") {
        await requireDesktopBackend().saveEndpoint({
          ...endpoint,
          lastSeenAt: readiness.checkedAt,
        });
        await invalidateRuntimeQueries(queryClient);
      }

      return readiness;
    },
  });

  const forget = useMutation<void, Error, string>({
    mutationFn: (endpointId) => requireDesktopBackend().forgetEndpoint(endpointId),
    onSuccess: () => invalidateRuntimeQueries(queryClient),
  });

  return {
    ...endpointsQuery,
    endpoints: endpointsQuery.data ?? [],
    connect,
    probe,
    forget,
  };
}
