import type { AgentResponse } from "@ngriffin_uk/polychat-schemas";
import { AGENT_MODE_CONFIGS, updateUserSettingsSchema } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AccountNavigation,
  AccountOverview,
  AccountPrompt,
  type AccountSection,
  AgentEditor,
  type AgentFormData,
  SandboxConnectionList,
  prepareUserSettingsPayload,
} from "./index";

afterEach(cleanup);

describe("account controls", () => {
  it("presents metered credits without a false zero allowance", () => {
    render(
      <AccountOverview
        user={{ plan_id: "pro", message_count: 1 }}
        isAuthenticated
        usageBalance={{
          period: "2026-09",
          resets_at: "2026-10-01T00:00:00.000Z",
          plan_id: "pro",
          credits: {
            included: 0,
            used: 0.1706,
            reserved: 0,
            grace: 0,
            overrun: 0.1706,
            overage: 0,
            overage_enabled: false,
            state: "exhausted",
          },
          credit_micros: {
            included: 0,
            spent: 170_600,
            reserved: 0,
            grace: 0,
            overrun: 170_600,
            overage: 0,
          },
          last_event_at: "2026-09-01T12:00:00.000Z",
        }}
        onSignIn={vi.fn()}
      />,
    );

    expect(screen.getByText("0.1706 used")).toBeTruthy();
    expect(screen.queryByText("0.1706 / 0")).toBeNull();
  });

  it("omits inactive S3 fields from the default Vectorize settings payload", () => {
    const payload = prepareUserSettingsPayload({
      embedding_provider: "vectorize",
      s3vectors_bucket_name: "",
      s3vectors_index_name: "",
      s3vectors_region: "us-east-1",
    });

    expect(payload).toEqual({ embedding_provider: "vectorize" });
    expect(updateUserSettingsSchema.safeParse(payload).success).toBe(true);
  });

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

describe("agent editor", () => {
  const personalAgent: AgentResponse = {
    id: "agent-1",
    user_id: 7,
    owner_scope_type: "user",
    owner_scope_id: "7",
    derived_from_agent_id: null,
    name: "Researcher",
    description: "Finds things",
    avatar_url: null,
    servers: [],
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    skill_ids: [],
    mode: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: null,
  };
  const workspaceAgent: AgentResponse = {
    ...personalAgent,
    id: "agent-2",
    owner_scope_type: "workspace",
    owner_scope_id: "workspace-1",
  };
  const publish = {
    workspaces: [{ id: "workspace-1", name: "Aviary" }],
    isPublishing: false,
    error: null,
    onPublish: vi.fn(),
  };

  function renderEditor(overrides: Partial<Parameters<typeof AgentEditor>[0]> = {}) {
    const onSubmit = vi.fn<(data: AgentFormData) => void>();

    render(
      <AgentEditor
        agent={personalAgent}
        models={{}}
        tools={[]}
        skills={[]}
        canManage
        isSaving={false}
        ownerLabel="you"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        {...overrides}
      />,
    );

    return onSubmit;
  }

  it("withholds saving and deleting from a viewer who cannot manage the agent", () => {
    renderEditor({
      agent: workspaceAgent,
      canManage: false,
      cannotManageReason: "Aviary owns this agent.",
      ownerLabel: "Aviary",
    });

    expect(screen.queryByRole("button", { name: "Save agent" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete agent" })).toBeNull();
    expect(screen.getByText("Aviary owns this agent.")).toBeTruthy();
    expect(screen.getByLabelText("Name").hasAttribute("disabled")).toBe(true);
  });

  it("offers every agent mode and describes it from the mode configuration", () => {
    renderEditor();

    for (const mode of ["Chat", "Plan", "Build", "Explore"]) {
      expect(screen.getByRole("radio", { name: new RegExp(`^${mode}`) })).toBeTruthy();
    }

    expect(screen.getByRole("radio", { name: /^Plan/ }).closest("label")?.textContent).toContain(
      `${AGENT_MODE_CONFIGS.plan.maxSteps} steps`,
    );
  });

  it("offers publishing only while the agent is still personally owned", () => {
    renderEditor({ agent: workspaceAgent, ownerLabel: "Aviary", publish });

    expect(screen.queryByLabelText("Publish to a workspace")).toBeNull();

    cleanup();
    renderEditor({ publish });

    expect(screen.getByLabelText("Publish to a workspace")).toBeTruthy();
  });

  it("reports the chosen mode and identity when the form is submitted", () => {
    const onSubmit = renderEditor({ agent: null });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Scout" } });
    fireEvent.click(screen.getByRole("radio", { name: /^Plan/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Scout", mode: "plan" });
  });

  it("refuses a name that is only whitespace", () => {
    const onSubmit = renderEditor({ agent: null });

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Create agent" }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("name");
  });
});
