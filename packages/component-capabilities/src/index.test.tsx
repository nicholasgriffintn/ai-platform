import type { AssistantActionItem } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityCard, CapabilityFilters } from "./index";

afterEach(cleanup);

function agentItem(
  availability: "available" | "unavailable",
  availabilityReason: string,
): AssistantActionItem {
  return {
    id: "agent:researcher",
    kind: "agent",
    label: "Researcher",
    description: "Digs through sources.",
    searchText: ["Researcher"],
    capability: {
      id: "researcher",
      kind: "agent",
      name: "Researcher",
      availability,
      availabilityReason,
      launch: { method: "conversation", action: "ask_agent" },
      executionMode: "agent",
      authRequirement: "signed_in",
      authState: "signed_in",
      operationAccess: "read",
      approvalPolicy: "never",
      requiredModelCapabilities: [],
      requiredConnectors: [],
      savedState: { supported: true },
      tags: ["agent"],
    },
    launch: {
      kind: "conversation" as const,
      operation: "ask_agent" as const,
      agentId: "researcher",
    },
    metadata: { agentId: "researcher" },
  };
}

describe("capability controls", () => {
  it("reports controlled filter changes without owning filter state", () => {
    const onCategoryChange = vi.fn();
    const onFiltersChange = vi.fn();
    const onQueryChange = vi.fn();

    render(
      <CapabilityFilters
        categories={["Research"]}
        category="all"
        filters={["configured"]}
        query=""
        onCategoryChange={onCategoryChange}
        onFiltersChange={onFiltersChange}
        onQueryChange={onQueryChange}
      />,
    );

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "weather" } });
    fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Research" } });

    expect(onQueryChange).toHaveBeenCalledWith("weather");
    expect(onFiltersChange).toHaveBeenCalledWith(["configured", "recipe"]);
    expect(onCategoryChange).toHaveBeenCalledWith("Research");
    expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("");
  });

  it("preserves the compact selected and hoverable filter variants", () => {
    render(
      <CapabilityFilters
        categories={["Research"]}
        category="Research"
        filters={["app", "recipe"]}
        query=""
        onCategoryChange={vi.fn()}
        onFiltersChange={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );

    const apps = screen.getByRole("button", { name: "Apps" });
    const all = screen.getByRole("button", { name: "All" });
    const research = screen.getByRole("button", { name: "Research" });

    expect(apps.className).toContain("px-3 py-1.5 text-xs");
    expect(apps.className).toContain("dark:bg-zinc-100");
    expect(all.className).toContain("dark:hover:bg-zinc-800");
    expect(research.className).toContain("dark:bg-zinc-800");
  });
});

describe("agent capability card", () => {
  it("starts a conversation with an agent the scope can run", () => {
    const onOpen = vi.fn();

    render(
      <CapabilityCard
        item={agentItem("available", "Agent is ready to run.")}
        kind="agent"
        onOpen={onOpen}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Start chat" }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("explains why an unavailable agent cannot be run instead of offering the action", () => {
    render(
      <CapabilityCard
        item={agentItem("unavailable", "These tools are not available here: sandbox.")}
        kind="agent"
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Start chat" })).toBeNull();
    expect(screen.getByText("These tools are not available here: sandbox.")).toBeTruthy();
  });

  it("lets an owner edit and delete the agent from the library card", () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();

    render(
      <CapabilityCard
        item={agentItem("available", "Agent is ready to run.")}
        kind="agent"
        onOpen={vi.fn()}
        authoredCapability={{ canManage: true, isDeleting: false, onDelete, onEdit }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit agent" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete agent" }));

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("offers marketplace sharing only when the agent supplies a share action", () => {
    const onShare = vi.fn();

    render(
      <CapabilityCard
        item={agentItem("available", "Agent is ready to run.")}
        kind="agent"
        onOpen={vi.fn()}
        authoredCapability={{ canManage: true, isDeleting: false, onDelete: vi.fn(), onShare }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Share agent" }));

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("hides sharing for an agent the viewer manages but cannot publish", () => {
    render(
      <CapabilityCard
        item={agentItem("available", "Agent is ready to run.")}
        kind="agent"
        onOpen={vi.fn()}
        authoredCapability={{
          canManage: true,
          isDeleting: false,
          onDelete: vi.fn(),
          onEdit: vi.fn(),
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.getByRole("menuitem", { name: "Edit agent" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Share agent" })).toBeNull();
  });

  it("withholds edit and delete from a viewer who cannot manage the agent", () => {
    render(
      <CapabilityCard
        item={agentItem("available", "Agent is ready to run.")}
        kind="agent"
        onOpen={vi.fn()}
        authoredCapability={{
          canManage: false,
          isDeleting: false,
          onDelete: vi.fn(),
          onEdit: vi.fn(),
        }}
      />,
    );

    expect(screen.getByRole("button", { name: "Start chat" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });
});
