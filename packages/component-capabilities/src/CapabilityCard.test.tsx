import type { AssistantActionItem, ModelToolDefinition } from "@ngriffin_uk/polychat-schemas";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityCard } from "./CapabilityCard";

afterEach(cleanup);

const appItem = {
  id: "app:featured-note-taker",
  kind: "app",
  label: "Note Taker",
  description: "Take notes",
  capability: { id: "featured-note-taker", description: "Take notes" },
  searchText: [],
  metadata: { appId: "featured-note-taker", category: "Productivity" },
} as unknown as AssistantActionItem;

const runnableToolItem = {
  id: "tool:get_weather",
  kind: "tool",
  label: "Get Weather",
  description: "Get a forecast",
  capability: { id: "get_weather", description: "Get a forecast" },
  searchText: [],
  metadata: { toolId: "get_weather", toolRunnable: true, category: "Research" },
} as unknown as AssistantActionItem;

const configuredModelToolItem = {
  id: "model_tool:file_search",
  kind: "model_tool",
  label: "File search",
  description: "Search configured vector stores",
  capability: { id: "file_search", description: "Search configured vector stores" },
  searchText: [],
  metadata: { toolId: "file_search", category: "Knowledge" },
} as unknown as AssistantActionItem;

const alwaysOnSkillItem = {
  id: "skill:recipes",
  kind: "skill",
  label: "Recipes",
  description: "Use saved recipes and connected services",
  capability: {
    id: "recipes",
    description: "Use saved recipes and connected services",
    savedState: { supported: false },
  },
  searchText: [],
} as unknown as AssistantActionItem;

const authoredSkillItem = {
  id: "skill:meeting-notes",
  kind: "skill",
  label: "meeting-notes",
  description: "Turn rough meeting notes into clear decisions and actions.",
  capability: {
    id: "meeting-notes",
    description: "Turn rough meeting notes into clear decisions and actions.",
    savedState: { supported: true },
  },
  searchText: [],
  metadata: { skillSource: "user-authored" },
} as unknown as AssistantActionItem;

const fileSearchTool: ModelToolDefinition = {
  id: "file_search",
  capability: "supportsFileSearch",
  category: "Knowledge",
  command: "file search",
  description: "Search configured vector stores",
  label: "File search",
  requiresConfiguration: true,
  configurationKind: "file_search",
};

function renderCard(props: Record<string, unknown>) {
  return render(<CapabilityCard {...(props as any)} />);
}

const projectActions = {
  canManage: true,
  isAdding: false,
  isRemoving: false,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
};

describe("CapabilityCard", () => {
  it("opens an experience directly when nothing needs enabling first", () => {
    renderCard({
      item: appItem,
      kind: "app",
      onOpen: vi.fn(),
    });

    expect(screen.getByRole("button", { name: "Open" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add to project" })).toBeNull();
  });

  it("runs a runnable tool directly when nothing needs enabling first", () => {
    renderCard({
      item: runnableToolItem,
      kind: "tool",
      onOpen: vi.fn(),
    });

    expect(screen.getByRole("button", { name: "Run" })).toBeTruthy();
  });

  it("shows whether a personal model tool still needs configuration", () => {
    renderCard({
      item: configuredModelToolItem,
      kind: "tool",
      isConfigured: false,
      onConfigure: vi.fn(),
      tool: fileSearchTool,
    });

    expect(screen.getByText("Configuration required")).toBeTruthy();
  });

  it("asks a project to attach the capability before it can be opened", () => {
    renderCard({
      item: appItem,
      kind: "app",
      projectActions,
    });

    expect(screen.getByRole("button", { name: "Add to project" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open" })).toBeNull();
  });

  it("does not offer to add an always-on skill to a project", () => {
    renderCard({
      item: alwaysOnSkillItem,
      kind: "skill",
      projectActions,
    });

    expect(screen.getByText("Always on")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add to project" })).toBeNull();
  });

  it("offers deletion from a user-authored personal skill card", () => {
    const onDelete = vi.fn();

    renderCard({
      item: authoredSkillItem,
      kind: "skill",
      skill: {
        alwaysOn: false,
        enabled: true,
        isPending: false,
        onToggle: vi.fn(),
      },
      authoredSkill: {
        canDelete: true,
        isDeleting: false,
        onDelete,
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete skill" }));

    expect(onDelete).toHaveBeenCalledOnce();
  });
});
