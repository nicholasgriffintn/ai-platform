import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceGovernance } from "./WorkspaceGovernance";

const mocks = vi.hoisted(() => ({
  deleteTemplate: vi.fn(async () => undefined),
}));

vi.mock("~/hooks/useGovernance", () => ({
  useWorkspaceAudit: () => ({ data: [], error: null, isLoading: false }),
  useWorkspaceTemplates: () => ({
    data: [
      {
        id: "template-1",
        kind: "project",
        name: "Research project",
        description: "Reusable research setup",
      },
    ],
    error: null,
    isLoading: false,
  }),
  useTemplateMutations: () => ({
    instantiate: { isPending: false, mutateAsync: vi.fn(), variables: undefined },
    remove: { isPending: false, mutateAsync: mocks.deleteTemplate },
  }),
}));

vi.mock("./WorkDataContext", () => ({
  useWorkData: () => ({
    workspaceQuery: {
      data: { role: "owner" },
      isLoading: false,
    },
  }),
}));

describe("WorkspaceGovernance", () => {
  it("confirms template deletion from the standard list treatment", async () => {
    render(
      <MemoryRouter>
        <WorkspaceGovernance workspaceId="workspace-1" />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Governance" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete project template" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete template" }));

    await waitFor(() => expect(mocks.deleteTemplate).toHaveBeenCalledWith("template-1"));
  });
});
