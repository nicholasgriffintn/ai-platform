import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApprovalRequestView } from "./ApprovalRequestView";

const pending = {
  message: "Write the approved document",
  approval: { interactionId: "interaction-1", toolName: "write_document" },
};

afterEach(cleanup);

describe("ApprovalRequestView authority", () => {
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
});
