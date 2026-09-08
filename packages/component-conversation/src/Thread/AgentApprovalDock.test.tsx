import { useAgentApprovalStore } from "@ngriffin_uk/polychat-library-client";
import type { AgentApproval } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AgentApprovalDock } from "./AgentApprovalDock.js";

function approval(overrides: Partial<AgentApproval> = {}): AgentApproval {
  return {
    requestId: "request-1",
    threadId: "thread-1",
    kind: "command_execution",
    title: "Run the migration script",
    detail: null,
    command: "pnpm db:migrate:local",
    cwd: "/workspace/assistant",
    decisions: ["accept", "accept_for_session", "decline", "cancel"],
    requestedAt: "2026-09-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("AgentApprovalDock", () => {
  beforeEach(() => {
    useAgentApprovalStore.setState({ approvals: {} });
  });

  afterEach(() => {
    cleanup();
  });

  it("sends the chosen decision and stops waiting on that approval", async () => {
    const answer = vi.fn().mockResolvedValue(undefined);

    useAgentApprovalStore.getState().requestApproval("conversation-1", approval(), answer);
    render(<AgentApprovalDock conversationId="conversation-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Allow for this session" }));

    await waitFor(() => expect(answer).toHaveBeenCalledWith("accept_for_session"));
    await waitFor(() =>
      expect(useAgentApprovalStore.getState().approvals["conversation-1"]).toBeUndefined(),
    );
    expect(screen.queryByText("Run the migration script")).toBeNull();
  });

  it("keeps the approval answerable when the decision cannot be delivered", async () => {
    const answer = vi
      .fn()
      .mockRejectedValueOnce(new Error("The agent session has gone quiet."))
      .mockResolvedValueOnce(undefined);

    useAgentApprovalStore.getState().requestApproval("conversation-1", approval(), answer);
    render(<AgentApprovalDock conversationId="conversation-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(screen.getByText("The agent session has gone quiet.")).toBeTruthy());
    expect(useAgentApprovalStore.getState().approvals["conversation-1"]).toHaveLength(1);

    const retry = screen.getByRole("button", { name: "Allow" });

    expect(retry.hasAttribute("disabled")).toBe(false);
    fireEvent.click(retry);

    await waitFor(() => expect(answer).toHaveBeenLastCalledWith("accept"));
    await waitFor(() =>
      expect(useAgentApprovalStore.getState().approvals["conversation-1"]).toBeUndefined(),
    );
  });

  it("only shows approvals belonging to the open conversation", () => {
    const store = useAgentApprovalStore.getState();

    store.requestApproval(
      "conversation-1",
      approval({ title: "Run the migration script" }),
      vi.fn(),
    );
    store.requestApproval(
      "conversation-2",
      approval({ requestId: "request-2", title: "Rewrite the release notes" }),
      vi.fn(),
    );

    render(<AgentApprovalDock conversationId="conversation-1" />);

    expect(screen.getByText("Run the migration script")).toBeTruthy();
    expect(screen.queryByText("Rewrite the release notes")).toBeNull();
  });
});
