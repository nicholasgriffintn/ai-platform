import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectActivity } from "./ProjectActivity";

vi.mock("~/hooks/useActivity", () => ({
	useActivity: () => ({
		data: [
			{
				id: "activity-1",
				capabilityId: "research",
				summary: "Research completed",
				status: "succeeded",
				createdAt: "2026-08-11T12:00:00.000Z",
				updatedAt: "2026-08-11T12:00:00.000Z",
			},
		],
		error: null,
		isLoading: false,
	}),
}));

describe("ProjectActivity", () => {
	it("renders activity within the standard project page hierarchy", () => {
		render(<ProjectActivity projectId="project-1" />);

		expect(screen.getByRole("heading", { level: 1, name: "Activity" })).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { level: 2, name: "Research completed" }),
		).toBeInTheDocument();
		expect(screen.getByText("succeeded")).toBeInTheDocument();
	});
});
