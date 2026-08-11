import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectOutputs } from "./ProjectOutputs";

vi.mock("./Experiences/ResponsesExperience", () => ({
	ResponsesExperience: () => <div>Output list</div>,
}));

describe("ProjectOutputs", () => {
	it("uses the standard project page heading", () => {
		render(<ProjectOutputs workspaceId="workspace-1" projectId="project-1" subpath="" />);

		expect(screen.getByRole("heading", { level: 1, name: "Outputs" })).toBeInTheDocument();
		expect(screen.getByText("Output list")).toBeInTheDocument();
	});
});
