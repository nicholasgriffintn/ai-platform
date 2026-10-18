import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeammatePageState } from "./TeammatePageState.js";

const auth = vi.hoisted(() => ({
  isAuthenticated: false,
  isAuthenticationLoading: true,
  isPro: false,
}));

vi.mock("../Host/ShellHostContext.js", () => ({
  useShellHost: () => ({ openSignIn: vi.fn() }),
}));

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
  useChatStore: (selector: (state: typeof auth) => unknown) => selector(auth),
}));

function renderState(props: { isLoading: boolean; error: unknown; isFound: boolean }) {
  return render(
    <MemoryRouter>
      <TeammatePageState noun="teammate" backPath="/chat/teammates" onRetry={vi.fn()} {...props}>
        <p>Conversation</p>
      </TeammatePageState>
    </MemoryRouter>,
  );
}

describe("TeammatePageState", () => {
  afterEach(() => {
    cleanup();
    Object.assign(auth, { isAuthenticated: false, isAuthenticationLoading: true, isPro: false });
  });

  it("waits for sign-in to settle instead of saying the teammate is missing", () => {
    renderState({ isLoading: false, error: null, isFound: false });

    expect(screen.getByText("Loading teammate…")).toBeTruthy();
    expect(screen.queryByText("Teammate not found")).toBeNull();
  });

  it("offers a retry for a failed request rather than calling it missing", () => {
    Object.assign(auth, { isAuthenticated: true, isAuthenticationLoading: false, isPro: true });
    renderState({ isLoading: false, error: new Error("Server error"), isFound: false });

    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.queryByText("Teammate not found")).toBeNull();
  });
});
