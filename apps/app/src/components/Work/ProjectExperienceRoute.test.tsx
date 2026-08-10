import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectExperienceRoute } from "./ProjectExperienceRoute";

vi.mock("~/hooks/useWorkspaces", () => ({
	useProject: () => ({
		data: {
			capabilities: [
				{ capabilityId: "featured-note-taker", configuration: {}, id: "capability-1", kind: "app" },
			],
		},
		error: null,
		isLoading: false,
	}),
}));
vi.mock("~/hooks/useDynamicApps", () => ({
	useDynamicApps: () => ({
		data: {
			apps: [
				{
					id: "featured-note-taker",
					name: "Note Taker",
					description: "Notes",
					kind: "frontend",
				},
			],
			experiences: [
				{
					id: "notes",
					runtime: "notes",
					name: "Note Taker",
					description: "Notes",
					requirement: {
						kind: "capability",
						capabilityKind: "app",
						capabilityId: "featured-note-taker",
					},
				},
			],
		},
		error: null,
		isLoading: false,
	}),
}));
vi.mock("./WorkPageShell", () => ({
	WorkPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./Experiences/NotesExperience", () => ({
	NotesExperience: ({ basePath, projectId }: { basePath: string; projectId: string }) => (
		<div data-testid="notes-experience" data-base-path={basePath} data-project-id={projectId} />
	),
}));

describe("ProjectExperienceRoute", () => {
	it("mounts an enabled rich experience inside its project path", () => {
		render(
			<MemoryRouter>
				<ProjectExperienceRoute
					experienceId="notes"
					projectId="project-1"
					workspaceId="workspace-1"
				/>
			</MemoryRouter>,
		);

		const experience = screen.getByTestId("notes-experience");
		expect(screen.getByRole("link", { name: "Back to experiences" })).toHaveAttribute(
			"href",
			"/work/workspace-1/projects/project-1/experiences",
		);
		expect(experience).toHaveAttribute("data-project-id", "project-1");
		expect(experience).toHaveAttribute(
			"data-base-path",
			"/work/workspace-1/projects/project-1/experiences/notes",
		);
	});
});
