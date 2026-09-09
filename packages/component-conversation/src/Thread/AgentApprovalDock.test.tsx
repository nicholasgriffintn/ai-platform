import type { AgentApproval } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    cleanup();
  });

  it("sends the chosen decision and resolves that approval", async () => {
    const answer = vi.fn().mockResolvedValue(undefined);
    const resolve = vi.fn();

    render(<AgentApprovalDock pending={[{ approval: approval(), answer }]} resolve={resolve} />);

    fireEvent.click(screen.getByRole("button", { name: "Allow for this session" }));

    await waitFor(() => expect(answer).toHaveBeenCalledWith("accept_for_session"));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("request-1"));
  });

  it("keeps the approval answerable when the decision cannot be delivered", async () => {
    const answer = vi
      .fn()
      .mockRejectedValueOnce(new Error("The agent session has gone quiet."))
      .mockResolvedValueOnce(undefined);
    const resolve = vi.fn();

    render(<AgentApprovalDock pending={[{ approval: approval(), answer }]} resolve={resolve} />);

    fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    await waitFor(() => expect(screen.getByText("The agent session has gone quiet.")).toBeTruthy());
    expect(resolve).not.toHaveBeenCalled();

    const retry = screen.getByRole("button", { name: "Allow" });

    expect(retry.hasAttribute("disabled")).toBe(false);
    fireEvent.click(retry);

    await waitFor(() => expect(answer).toHaveBeenLastCalledWith("accept"));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith("request-1"));
  });
});
