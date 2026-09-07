// @vitest-environment jsdom

import {
  createFakeDesktopBackend,
  setDesktopExecutionBackend,
} from "@ngriffin_uk/polychat-library-chat";
import type {
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DEVICE_MODELS_QUERY_KEY } from "./useDeviceModels.js";
import { useRuntimeEndpoints } from "./useRuntimeEndpoints.js";

const candidate: DesktopEndpointCandidate = {
  id: "ollama-loopback",
  kind: "model",
  vendor: "ollama",
  label: "Ollama",
  url: "http://127.0.0.1:11434",
  transport: "loopback",
};

const ready: DesktopRuntimeReadiness = {
  status: "ready",
  checkedAt: "2026-09-07T09:00:00.000Z",
  version: "0.12.3",
};

function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useRuntimeEndpoints", () => {
  afterEach(() => {
    setDesktopExecutionBackend(null);
  });

  it("lists saved endpoints without probing them when the page opens", async () => {
    const backend = createFakeDesktopBackend({ endpoints: [] });

    setDesktopExecutionBackend(backend);

    const { result } = renderHook(() => useRuntimeEndpoints(), {
      wrapper: createWrapper(createQueryClient()),
    });

    await waitFor(() => expect(result.current.endpoints).toEqual([]));

    expect(backend.probedEndpoints).toEqual([]);
  });

  it("probes before saving and invalidates device models after a successful connection", async () => {
    const backend = createFakeDesktopBackend({ readiness: { [candidate.id]: ready } });
    const calls: string[] = [];
    const originalProbe = backend.probeEndpoint;
    const originalSave = backend.saveEndpoint;

    backend.probeEndpoint = async (...args) => {
      calls.push("probe");

      return originalProbe(...args);
    };

    backend.saveEndpoint = async (...args) => {
      calls.push("save");
      await originalSave(...args);
    };

    setDesktopExecutionBackend(backend);

    const queryClient = createQueryClient();

    queryClient.setQueryData([DEVICE_MODELS_QUERY_KEY], { device: {} });
    const { result } = renderHook(() => useRuntimeEndpoints(), {
      wrapper: createWrapper(queryClient),
    });

    let connection: Awaited<ReturnType<typeof result.current.connect.mutateAsync>> | undefined;

    await act(async () => {
      connection = await result.current.connect.mutateAsync(candidate);
    });

    expect(connection).toEqual({ ok: true, readiness: ready });
    expect(calls).toEqual(["probe", "save"]);
    expect(backend.probedEndpoints).toEqual([{ endpointId: candidate.id, url: candidate.url }]);
    expect(await backend.listEndpoints()).toHaveLength(1);
    expect(queryClient.getQueryState([DEVICE_MODELS_QUERY_KEY])?.isInvalidated).toBe(true);
  });

  it("does not save a candidate when the probe cannot reach it", async () => {
    const unreachable: DesktopRuntimeReadiness = {
      status: "unreachable",
      checkedAt: "2026-09-07T09:00:00.000Z",
      detail: "Ollama is not running.",
    };
    const backend = createFakeDesktopBackend({ readiness: { [candidate.id]: unreachable } });

    setDesktopExecutionBackend(backend);

    const { result } = renderHook(() => useRuntimeEndpoints(), {
      wrapper: createWrapper(createQueryClient()),
    });

    let connection: Awaited<ReturnType<typeof result.current.connect.mutateAsync>> | undefined;

    await act(async () => {
      connection = await result.current.connect.mutateAsync(candidate);
    });

    expect(connection).toEqual({ ok: false, readiness: unreachable });
    expect(backend.probedEndpoints).toEqual([{ endpointId: candidate.id, url: candidate.url }]);
    expect(await backend.listEndpoints()).toEqual([]);
  });
});
