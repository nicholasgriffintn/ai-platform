// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalRequestView } from "./ApprovalRequestView";

const pendingApproval = {
  message: "Run the requested tool?",
  options: ["Approve", "Reject"],
  approval: {
    interactionId: "interaction-1",
    toolName: "dangerous_tool",
  },
  humanInTheLoop: {
    type: "approval",
    status: "pending",
    requires_user_action: true,
  },
};

describe("ApprovalRequestView", () => {
  afterEach(cleanup);

  it("waits for acknowledgement and prevents duplicate submissions", async () => {
    let acknowledge: (() => void) | undefined;
    const onToolInteraction = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          acknowledge = resolve;
        }),
    );

    render(
      <ApprovalRequestView
        data={pendingApproval}
        embedded={false}
        onToolInteraction={onToolInteraction}
      />,
    );

    const approveButton = screen.getByRole("button", { name: "Approve" });

    fireEvent.click(approveButton);
    fireEvent.click(approveButton);

    expect(onToolInteraction).toHaveBeenCalledTimes(1);
    expect(onToolInteraction).toHaveBeenCalledWith("dangerous_tool", "submitPrompt", {
      option: "Approve",
      message: "Run the requested tool?",
      input: "Approve: Run the requested tool?",
      interactionId: "interaction-1",
      resolution: "approved",
      approvedToolName: "dangerous_tool",
    });
    expect(screen.getByText("Submitting Approve…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeDisabled();
    expect(screen.queryByText("You chose Approve.")).not.toBeInTheDocument();

    await act(async () => acknowledge?.());

    expect(screen.getByText("You chose Approve.")).toBeInTheDocument();
  });

  it("keeps a failed approval clear and retryable", async () => {
    const onToolInteraction = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(undefined);

    render(
      <ApprovalRequestView
        data={pendingApproval}
        embedded={false}
        onToolInteraction={onToolInteraction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approval was not submitted. Try again.",
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.queryByText("You chose Reject.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByText("You chose Reject.")).toBeInTheDocument();
    expect(onToolInteraction).toHaveBeenCalledTimes(2);
  });

  it("prefers authoritative resolution over stale local submission state", () => {
    const onToolInteraction = vi.fn(() => new Promise<void>(() => undefined));
    const { rerender } = render(
      <ApprovalRequestView
        data={pendingApproval}
        embedded={false}
        onToolInteraction={onToolInteraction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    rerender(
      <ApprovalRequestView
        data={{
          ...pendingApproval,
          resolved: true,
          resolution: "approved",
          humanInTheLoop: {
            ...pendingApproval.humanInTheLoop,
            status: "resolved",
            resolution: "approved",
            requires_user_action: false,
          },
        }}
        embedded={false}
        onToolInteraction={onToolInteraction}
      />,
    );

    expect(screen.getByText("Approved.")).toBeInTheDocument();
    expect(screen.queryByText("Submitting Reject…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("renders an authoritative expiry as terminal", () => {
    render(
      <ApprovalRequestView
        data={{
          ...pendingApproval,
          expiresAt: "2020-01-01T00:00:00.000Z",
        }}
        embedded={false}
        onToolInteraction={vi.fn()}
      />,
    );

    expect(screen.getByText("This approval request expired.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
