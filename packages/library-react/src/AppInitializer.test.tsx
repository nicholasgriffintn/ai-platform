// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppInitializer } from "./AppInitializer.js";
import { useUIStore } from "./state/stores/uiStore.js";

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

    render(
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

    render(
      <AppInitializer>
        <span>chat</span>
      </AppInitializer>,
    );

    await waitFor(() => expect(useUIStore.getState().isMobileLoading).toBe(false));

    vi.unstubAllGlobals();
  });
});
