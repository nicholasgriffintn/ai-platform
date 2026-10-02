import type { BrowserApproval } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { BrowserAuthenticationForm } from "./BrowserAuthenticationForm.js";

const approval: BrowserApproval = {
  requestId: "login",
  turnId: "turn",
  request: {
    type: "browser_authentication",
    credential_origin: "https://example.test",
    reason: "Read private issues",
    options: [],
    fields: [
      { id: "email", label: "Email", type: "email", required: true },
      { id: "password", label: "Password", type: "password", required: true },
    ],
  },
};

afterEach(cleanup);

describe("browser sign-in", () => {
  it("masks every value and clears fields before sending the response", () => {
    const respond = vi.fn(async () => undefined);

    render(<BrowserAuthenticationForm approval={approval} disabled={false} onRespond={respond} />);
    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");

    expect(email.getAttribute("type")).toBe("password");
    expect(password.getAttribute("type")).toBe("password");
    fireEvent.change(email, { target: { value: "tester@example.test" } });
    fireEvent.change(password, { target: { value: "test-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit sign-in" }));
    expect(respond).toHaveBeenCalledWith({
      type: "browser_authentication",
      action: "submit",
      fields: [
        { field_id: "email", value: "tester@example.test" },
        { field_id: "password", value: "test-secret" },
      ],
    });
    expect(screen.queryByDisplayValue("tester@example.test")).toBeNull();
    expect(screen.queryByDisplayValue("test-secret")).toBeNull();
  });
  it("allows cancellation but prevents sign-in without a verified HTTPS destination", () => {
    if (approval.request.type !== "browser_authentication") {
      throw new Error("Unexpected fixture");
    }

    const respond = vi.fn(async () => undefined);

    render(
      <BrowserAuthenticationForm
        approval={{ ...approval, request: { ...approval.request, credential_origin: null } }}
        disabled={false}
        onRespond={respond}
      />,
    );
    expect(screen.getByRole("button", { name: "Submit sign-in" }).hasAttribute("disabled")).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel sign-in" }));
    expect(respond).toHaveBeenCalledWith({ type: "browser_authentication", action: "cancel" });
  });
});
