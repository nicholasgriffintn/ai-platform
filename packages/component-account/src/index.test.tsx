import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountNavigation,
  AccountPrompt,
  type AccountSection,
  SandboxConnectionList,
} from "./index";

afterEach(cleanup);

describe("account controls", () => {
  it("reports enabled navigation choices while explaining unavailable ones", () => {
    const onSelect = vi.fn<(section: AccountSection) => void>();
    const sections = [
      { id: "profile", label: "Profile" },
      { id: "billing", label: "Billing", disabledReason: "Owners only" },
    ];

    render(<AccountNavigation sections={sections} activeSectionId="profile" onSelect={onSelect} />);

    const active = screen.getByRole("button", { name: "Profile" });
    const unavailable = screen.getByRole("button", { name: "Billing" });

    expect(active.getAttribute("aria-current")).toBe("page");
    expect(unavailable.hasAttribute("disabled")).toBe(true);
    expect(unavailable.title).toBe("Owners only");

    fireEvent.click(active);
    fireEvent.click(unavailable);
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith(sections[0]);
  });

  it("prevents an unavailable account action", () => {
    const onAction = vi.fn();

    render(
      <AccountPrompt
        title="Upgrade"
        description="Unlock team controls."
        actionLabel="Upgrade plan"
        actionUnavailableReason="Contact the workspace owner"
        onAction={onAction}
      />,
    );

    const action = screen.getByRole("button", { name: "Upgrade plan" });

    expect(action.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Contact the workspace owner")).toBeTruthy();
    fireEvent.click(action);
    expect(onAction).not.toHaveBeenCalled();
  });
});

describe("sandbox connection list", () => {
  const connections = [
    { installationId: 1, appId: "app-1", updatedAt: new Date().toISOString(), repositories: [] },
    { installationId: 2, appId: "app-2", updatedAt: new Date().toISOString(), repositories: [] },
  ];

  it("only blocks the row whose deletion is in flight", () => {
    const onDelete = vi.fn<(installationId: number) => void>();

    render(
      <SandboxConnectionList
        connections={connections}
        onSignIn={vi.fn()}
        onDelete={onDelete}
        deletingInstallationId={1}
      />,
    );

    const [deleting, other] = screen.getAllByRole("button", { name: /Remove/ });

    expect(deleting.hasAttribute("disabled")).toBe(true);
    expect(other.hasAttribute("disabled")).toBe(false);

    fireEvent.click(other);
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(2);
  });
});
