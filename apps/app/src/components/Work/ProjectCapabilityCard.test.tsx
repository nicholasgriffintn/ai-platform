import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { AssistantActionItem, ProjectExperienceDefinition } from "@assistant/schemas";

import { ProjectCapabilityCard } from "./ProjectCapabilityCard";

const appItem = {
	id: "app:music-studio",
	kind: "app",
	label: "Music Studio",
	searchText: [],
	capability: {
		id: "music-studio",
		kind: "frontend_app",
		name: "Music Studio",
		availability: "available",
		launch: { method: "navigation" },
		executionMode: "navigation",
		authRequirement: "none",
		requiredModelCapabilities: [],
		requiredConnectors: [],
		savedState: { supported: false },
		tags: [],
	},
	launch: { kind: "navigation", path: "/apps/music" },
	metadata: { appKind: "frontend" },
} satisfies AssistantActionItem;

const experiences: ProjectExperienceDefinition[] = [
	{
		id: "music",
		description: "Create music",
		name: "Music Studio",
		requirement: {
			kind: "capability",
			capabilityKind: "app",
			capabilityId: "music-studio",
		},
		runtime: "strudel",
	},
];

const callableToolItem = {
	id: "tool:get_weather",
	kind: "tool",
	label: "Get Weather",
	searchText: [],
	capability: {
		id: "get_weather",
		kind: "tool",
		name: "Get Weather",
		availability: "available",
		launch: { method: "tool_toggle" },
		executionMode: "tool",
		authRequirement: "none",
		requiredModelCapabilities: [],
		requiredConnectors: [],
		savedState: { supported: false },
		tags: ["tool"],
	},
	launch: { kind: "tool_toggle", toolId: "get_weather" },
} satisfies AssistantActionItem;

function LocationProbe() {
	const location = useLocation();
	return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

describe("ProjectCapabilityCard", () => {
	it("uses Open as the primary app action and keeps removal in the actions menu", () => {
		const onRemove = vi.fn();

		render(
			<MemoryRouter>
				<ProjectCapabilityCard
					canManage
					existing={{
						id: "capability-1",
						projectId: "project-1",
						kind: "app",
						capabilityId: "music-studio",
						configuration: {},
						createdBy: 42,
						createdAt: "2026-01-01",
					}}
					experiences={experiences}
					isAdding={false}
					isRemoving={false}
					item={appItem}
					kind="app"
					onAdd={vi.fn()}
					onRemove={onRemove}
					projectId="project-1"
					workspaceId="workspace-1"
				/>
				<LocationProbe />
			</MemoryRouter>,
		);

		const open = screen.getByRole("button", { name: "Open" });
		expect(open).toHaveClass("bg-blue-600");
		fireEvent.click(open);
		expect(screen.getByTestId("location")).toHaveTextContent(
			"/work/workspace-1/projects/project-1/experiences/music",
		);

		expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "More actions" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Remove from project" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("treats API tools as included defaults and exposes required configuration", () => {
		const onConfigure = vi.fn();
		const toolItem = {
			id: "tool:file_search",
			kind: "tool",
			label: "File search",
			searchText: [],
			capability: {
				id: "file_search",
				kind: "tool",
				name: "File search",
				availability: "available",
				launch: { method: "tool_toggle" },
				executionMode: "tool",
				authRequirement: "none",
				requiredModelCapabilities: ["supportsFileSearch"],
				requiredConnectors: [],
				savedState: { supported: false },
				tags: ["tool"],
			},
			launch: { kind: "tool_toggle", toolId: "file_search" },
		} satisfies AssistantActionItem;

		render(
			<MemoryRouter>
				<ProjectCapabilityCard
					canManage
					experiences={[]}
					isAdding={false}
					isConfigured={false}
					isRemoving={false}
					item={toolItem}
					kind="tool"
					onAdd={vi.fn()}
					onConfigure={onConfigure}
					onRemove={vi.fn()}
					projectId="project-1"
					tool={{
						id: "file_search",
						capability: "supportsFileSearch",
						category: "Knowledge",
						command: "file search",
						configurationKind: "file_search",
						description: "Search configured vector stores",
						label: "File search",
						requiresConfiguration: true,
					}}
					workspaceId="workspace-1"
				/>
			</MemoryRouter>,
		);

		expect(screen.getByText("Configuration required")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add to project" })).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Configure" }));
		expect(onConfigure).toHaveBeenCalledOnce();
	});

	it("lets project managers add and remove callable tools", () => {
		const onAdd = vi.fn();
		const onRemove = vi.fn();
		const { rerender } = render(
			<MemoryRouter>
				<ProjectCapabilityCard
					canManage
					experiences={[]}
					isAdding={false}
					isRemoving={false}
					item={callableToolItem}
					kind="tool"
					onAdd={onAdd}
					onRemove={onRemove}
					projectId="project-1"
					workspaceId="workspace-1"
				/>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Add to project" }));
		expect(onAdd).toHaveBeenCalledOnce();

		rerender(
			<MemoryRouter>
				<ProjectCapabilityCard
					canManage
					existing={{
						id: "capability-1",
						projectId: "project-1",
						kind: "tool",
						capabilityId: "get_weather",
						configuration: {},
						createdBy: 42,
						createdAt: "2026-01-01",
					}}
					experiences={[]}
					isAdding={false}
					isRemoving={false}
					item={callableToolItem}
					kind="tool"
					onAdd={onAdd}
					onRemove={onRemove}
					projectId="project-1"
					workspaceId="workspace-1"
				/>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "More actions" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Remove from project" }));
		expect(onRemove).toHaveBeenCalledOnce();
	});
});
