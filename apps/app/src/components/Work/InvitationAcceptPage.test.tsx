import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { InvitationAcceptPage } from "./InvitationAcceptPage";

vi.mock("~/state/stores/chatStore", () => ({
  useChatStore: (selector: (state: { isAuthenticated: boolean }) => unknown) =>
    selector({ isAuthenticated: false }),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
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
