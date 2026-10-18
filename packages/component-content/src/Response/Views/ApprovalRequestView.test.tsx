import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalRequestView } from "./ApprovalRequestView";

const pending = {
  message: "Write the approved document",
  approval: { interactionId: "interaction-1", toolName: "write_document" },
};

afterEach(cleanup);

describe("ApprovalRequestView authority", () => {
  it.each(["Approve", "Reject"])("binds %s to the stored interaction", async (option) => {
    const submit = vi.fn(async () => {});

    render(<ApprovalRequestView embedded data={pending} onToolInteraction={submit} />);
    fireEvent.click(screen.getByRole("button", { name: option }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(`You chose ${option}.`),
    );
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      "write_document",
      "submitPrompt",
      expect.objectContaining({
        option,
        interactionId: "interaction-1",
        resolution: option === "Approve" ? "approved" : "rejected",
      }),
    );
  });

  it.each([
    { expiresAt: "2000-01-01T00:00:00.000Z" },
    { status: "expired" },
    { humanInTheLoop: { status: "expired" } },
  ])("removes actions from expired approval %j", (expiry) => {
    const submit = vi.fn();

    render(
      <ApprovalRequestView embedded data={{ ...pending, ...expiry }} onToolInteraction={submit} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("This approval request expired.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it("replaces local acknowledgement with the refreshed server decision", async () => {
    const submit = vi.fn(async () => {});
    const { rerender } = render(
      <ApprovalRequestView embedded data={pending} onToolInteraction={submit} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("You chose Approve."));
    rerender(
      <ApprovalRequestView
        embedded
        data={{ ...pending, status: "resolved", resolution: "rejected" }}
        onToolInteraction={submit}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Rejected.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe("ApprovalRequestView rule shortcuts", () => {
  const actionApproval = {
    ...pending,
    approvalRequired: true,
    approval: { ...pending.approval, allowRuleLifts: true },
  };

  it("approves and asks to always allow the tool", async () => {
    const submit = vi.fn(async () => {});

    render(<ApprovalRequestView embedded data={actionApproval} onToolInteraction={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Always allow write_document" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(
      "write_document",
      "submitPrompt",
      expect.objectContaining({ option: "Approve", resolution: "approved", rule: "act" }),
    );
  });

  it("only offers always allow when a rule would stop the ask", () => {
    render(
      <ApprovalRequestView
        embedded
        data={{ ...actionApproval, approval: pending.approval }}
        onToolInteraction={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Always allow/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Never use write_document" })).toBeInTheDocument();
  });

  it("rejects and hands the tool back for good", async () => {
    const submit = vi.fn(async () => {});

    render(<ApprovalRequestView embedded data={actionApproval} onToolInteraction={submit} />);
    fireEvent.click(screen.getByRole("button", { name: "Never use write_document" }));

    await waitFor(() => expect(submit).toHaveBeenCalledOnce());
    expect(submit).toHaveBeenCalledWith(
      "write_document",
      "submitPrompt",
      expect.objectContaining({ option: "Reject", resolution: "rejected", rule: "hand_off" }),
    );
  });
});
