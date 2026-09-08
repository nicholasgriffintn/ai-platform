// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppInitializer } from "./AppInitializer.js";
import { useUIStore } from "./state/stores/uiStore.js";

function renderWithQueryClient(ui: Parameters<typeof render>[0]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

vi.mock("./hooks/useAuth.js", () => ({ useAuthStatus: () => undefined }));
vi.mock("./hooks/use-analytics-identity.js", () => ({ useAnalyticsIdentity: () => undefined }));
vi.mock("./hooks/useTheme.js", () => ({ useApplyTheme: () => undefined }));

describe("AppInitializer", () => {
  it("settles the viewport state every surface waits on before it renders", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    useUIStore.setState({ isMobileLoading: true });

    renderWithQueryClient(
      <AppInitializer>
        <span>chat</span>
      </AppInitializer>,
    );

    await waitFor(() => expect(useUIStore.getState().isMobileLoading).toBe(false));

    vi.unstubAllGlobals();
  });

  it("settles it even on a host without media queries, so nothing waits forever", async () => {
    vi.stubGlobal("matchMedia", undefined);
    useUIStore.setState({ isMobileLoading: true });

    renderWithQueryClient(
      <AppInitializer>
        <span>chat</span>
      </AppInitializer>,
    );

    await waitFor(() => expect(useUIStore.getState().isMobileLoading).toBe(false));

    vi.unstubAllGlobals();
  });
});
