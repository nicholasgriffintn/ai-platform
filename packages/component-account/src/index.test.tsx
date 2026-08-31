import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountNavigation,
  AccountPrompt,
  type AccountSection,
  SandboxConnectionList,
  TeamCard,
} from "./index";

afterEach(cleanup);

function buildAgent(overrides: Partial<AgentResponse> & Pick<AgentResponse, "id" | "name">) {
  return {
    user_id: 1,
    description: "",
    avatar_url: null,
    servers: [],
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    team_id: null,
    team_role: null,
    is_team_agent: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  } satisfies AgentResponse;
}

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

  it("names every icon-only team action for screen readers", () => {
    const team = {
      id: "team-1",
      name: "Research",
      orchestrator: buildAgent({ id: "lead-1", name: "Kea" }),
      members: [buildAgent({ id: "member-1", name: "Macaw", team_role: "specialist" })],
    };

    render(<TeamCard team={team} onEdit={vi.fn()} onShare={vi.fn()} onDelete={vi.fn()} />);

    const expand = screen.getByRole("button", {
      name: "Show Research members",
    });

    expect(screen.getByRole("button", { name: "More actions for team Research" })).toBeTruthy();

    fireEvent.click(expand);

    expect(screen.getByRole("button", { name: "Hide Research members" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More actions for Kea" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "More actions for Macaw" })).toBeTruthy();
  });
});

describe("sandbox connection list", () => {
  const connections = [
    {
      installationId: 1,
      appId: "app-1",
      updatedAt: new Date().toISOString(),
      repositories: [],
    },
    {
      installationId: 2,
      appId: "app-2",
      updatedAt: new Date().toISOString(),
      repositories: [],
    },
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
