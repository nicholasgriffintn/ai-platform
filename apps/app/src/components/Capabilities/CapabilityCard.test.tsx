import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type {
	AssistantActionItem,
	ProjectExperienceDefinition,
} from "@ngriffin_uk/polychat-schemas";

import { CapabilityCard } from "./CapabilityCard";
import { getProjectSurface, PERSONAL_SURFACE } from "~/lib/capability-surfaces";

const notesExperience: ProjectExperienceDefinition = {
	id: "notes",
	runtime: "notes",
	name: "Note Taker",
	description: "Take notes",
	requirement: { kind: "capability", capabilityKind: "app", capabilityId: "featured-note-taker" },
};

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

function renderCard(props: Record<string, unknown>) {
	return render(
		<MemoryRouter>
			<CapabilityCard
				canManage
				isAdding={false}
				isRemoving={false}
				onAdd={vi.fn()}
				onRemove={vi.fn()}
				experiences={[notesExperience]}
				{...(props as any)}
			/>
		</MemoryRouter>,
	);
}

describe("CapabilityCard", () => {
	it("opens an experience directly when nothing needs enabling first", () => {
		renderCard({
			item: appItem,
			kind: "app",
			surface: PERSONAL_SURFACE,
			requiresExplicitEnablement: false,
		});

		expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add to project" })).not.toBeInTheDocument();
	});

	it("runs a runnable tool directly when nothing needs enabling first", () => {
		renderCard({
			item: runnableToolItem,
			kind: "tool",
			surface: PERSONAL_SURFACE,
			requiresExplicitEnablement: false,
		});

		expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
	});

	it("asks a project to attach the capability before it can be opened", () => {
		renderCard({
			item: appItem,
			kind: "app",
			surface: getProjectSurface("w1", "p1"),
			requiresExplicitEnablement: true,
		});

		expect(screen.getByRole("button", { name: "Add to project" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Open" })).not.toBeInTheDocument();
	});
});
