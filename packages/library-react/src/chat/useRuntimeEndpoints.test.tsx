import { setDesktopExecutionBackend } from "@ngriffin_uk/polychat-library-chat";
import { apiService, useChatStore } from "@ngriffin_uk/polychat-library-client";
// @vitest-environment jsdom
import type {
  DesktopEndpointCandidate,
  DesktopRuntimeReadiness,
} from "@ngriffin_uk/polychat-schemas";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeDesktopBackend } from "../lib/testing/desktop-backend.js";
import {
  createQueryClient,
  createWrapper,
  clearQueryClients,
} from "../lib/testing/query-client.js";
import { DEVICE_MODELS_QUERY_KEY } from "./useDeviceModels.js";
import { useModels } from "./useModels.js";
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

describe("useRuntimeEndpoints", () => {
  afterEach(() => {
    cleanup();
    clearQueryClients();
    setDesktopExecutionBackend(null);
    vi.restoreAllMocks();
    useChatStore.setState({ isAuthenticated: false });
  });

  it("keeps the loaded catalogue visible while sign-in starts machine discovery", async () => {
    vi.spyOn(apiService, "fetchModels").mockResolvedValue({});
    vi.spyOn(apiService, "fetchMachines").mockImplementation(() => new Promise(() => {}));
    useChatStore.setState({ isAuthenticated: false });
    const queryClient = createQueryClient();
    const { result, unmount } = renderHook(() => useModels(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => useChatStore.setState({ isAuthenticated: true }));
    await waitFor(() => expect(apiService.fetchMachines).toHaveBeenCalledOnce());
    expect(result.current.isFetching).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toEqual({});
    unmount();
    queryClient.clear();
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
