import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectConversationStarter } from "./ProjectConversationStarter";

const navigate = vi.hoisted(() => vi.fn());

vi.mock("react-router", () => ({
	useNavigate: () => navigate,
}));

describe("ProjectConversationStarter", () => {
	it("starts a project conversation immediately with the entered prompt", () => {
		render(<ProjectConversationStarter workspaceId="workspace-1" projectId="project-1" />);

		fireEvent.change(screen.getByRole("textbox", { name: "Start a project conversation" }), {
			target: { value: "  Prepare the launch brief  " },
		});
		fireEvent.click(screen.getByRole("button", { name: "Start conversation" }));

		expect(navigate).toHaveBeenCalledTimes(1);
		const destination = new URL(navigate.mock.calls[0][0], "https://polychat.test");
		expect(destination.pathname).toBe("/work/workspace-1/projects/project-1/chat");
		expect(destination.searchParams.get("query")).toBe("Prepare the launch brief");
		expect(destination.searchParams.get("auto_submit")).toBe("1");
	});
});
