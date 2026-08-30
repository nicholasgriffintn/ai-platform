import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authService } from "~/lib/api/auth-service";

import VerifyMagicLinkRoute from "./verify-magic-link";

const navigate = vi.fn();
const refreshAuthStatus = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
  useSearchParams: () => [new URLSearchParams("token=magic-token")],
}));

vi.mock("~/hooks/useAuth", () => ({
  useAuthStatus: () => ({ refreshAuthStatus }),
}));

vi.mock("~/components/Core/PageShell", () => ({
  PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe("VerifyMagicLinkRoute", () => {
  beforeEach(() => {
    navigate.mockReset();
    refreshAuthStatus.mockReset();
    refreshAuthStatus.mockResolvedValue({});
  });

  it("refreshes authenticated app state before redirecting", async () => {
    vi.spyOn(authService, "verifyMagicLink").mockResolvedValue({ success: true });
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </MemoryRouter>
    );

    render(<VerifyMagicLinkRoute />, { wrapper: Wrapper });

    await waitFor(() => expect(refreshAuthStatus).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith("/");
    expect(refreshAuthStatus.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
  });
});
