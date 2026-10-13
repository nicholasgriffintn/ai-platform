import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeammateConnectionGrantsPanel } from "./TeammateConnectionGrantsPanel.js";

const { state } = vi.hoisted(() => ({
  state: {
    connections: [
      {
        id: "conn-1",
        provider: "github",
        providerName: "GitHub",
        accountId: "acct_123456",
        operations: [
          { id: "GITHUB_GET_AN_ISSUE", access: "read", destructive: false, important: true },
          { id: "GITHUB_LIST_PULL_REQUESTS", access: "read", destructive: false, important: false },
          {
            id: "GITHUB_ADD_LABELS_TO_AN_ISSUE",
            access: "write",
            destructive: false,
            important: true,
          },
          {
            id: "GITHUB_DELETE_A_REPOSITORY",
            access: "write",
            destructive: true,
            important: false,
          },
        ],
      },
    ],
    grants: [
      {
        id: "grant-1",
        contextId: "ctx",
        connectionId: "conn-1",
        allowedOperations: ["GITHUB_GET_AN_ISSUE"],
        revision: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
      },
    ],
    isLoading: false,
    error: null,
    update: { mutate: vi.fn(), isPending: false, error: null },
  },
}));

vi.mock("@ngriffin_uk/polychat-library-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-library-react")>()),
  useTeammateConnectionGrants: () => state,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("TeammateConnectionGrantsPanel", () => {
  it("renders humanised operations grouped by access with the saved selection", () => {
    render(<TeammateConnectionGrantsPanel contextId="ctx" />);

    expect(screen.getByText("1 of 4 operations granted · 1 read, 0 write")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Get an issue/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Delete a repository/ })).not.toBeChecked();
    expect(screen.getByText("Destructive")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save access" })).toBeDisabled();
  });

  it("filters by search and access, and saves the sorted selection with the revision", () => {
    render(<TeammateConnectionGrantsPanel contextId="ctx" />);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "repository" } });
    expect(screen.getByText("1 of 4 operations match")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Get an issue/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Delete a repository/ }));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("radio", { name: /Selected/ }));
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Save access" }));
    expect(state.update.mutate).toHaveBeenCalledWith({
      connectionId: "conn-1",
      allowedOperations: ["GITHUB_DELETE_A_REPOSITORY", "GITHUB_GET_AN_ISSUE"],
      expectedRevision: 2,
    });
  });

  it("bulk selects read operations and discards unsaved changes", () => {
    render(<TeammateConnectionGrantsPanel contextId="ctx" />);

    fireEvent.click(screen.getByRole("button", { name: "Allow all read" }));
    expect(screen.getByText("2 of 4 operations granted · 2 read, 0 write")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByText("1 of 4 operations granted · 1 read, 0 write")).toBeInTheDocument();
  });
});
