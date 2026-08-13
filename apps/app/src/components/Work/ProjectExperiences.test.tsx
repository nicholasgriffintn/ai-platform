import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectExperiences } from "./ProjectExperiences";

vi.mock("~/hooks/useDynamicApps", () => ({
	useDynamicApps: () => ({
		data: { apps: [], experiences: [] },
		error: null,
		isLoading: false,
	}),
}));

vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		projectQuery: {
			data: { capabilities: [], name: "Project" },
			error: null,
			isLoading: false,
		},
	}),
}));

describe("ProjectExperiences", () => {
	it("compacts its single header action on mobile", () => {
		render(
			<MemoryRouter>
				<ProjectExperiences workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		const manageCapabilities = screen.getByRole("link", { name: "Manage capabilities" });
		expect(manageCapabilities).toHaveClass("w-8", "sm:w-auto");
		expect(screen.getByText("Manage capabilities", { selector: "span" })).toHaveClass(
			"hidden",
			"sm:inline",
		);
	});
});
