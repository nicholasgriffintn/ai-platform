import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { InvitationAcceptPage } from "./InvitationAcceptPage.js";

vi.mock("@ngriffin_uk/polychat-library-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-client")>()),
  useChatStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useAcceptWorkspaceInvitation: () => ({
    data: undefined,
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

describe("InvitationAcceptPage", () => {
  it("gives guests a sign-in action", () => {
    render(
      <MemoryRouter initialEntries={["/work/invitations?token=token"]}>
        <InvitationAcceptPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
