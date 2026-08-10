import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectBriefCard } from "./ProjectBriefCard";

const mutateAsync = vi.fn().mockResolvedValue({});

vi.mock("~/hooks/useWorkspaces", () => ({
	useUpdateProject: () => ({
		error: null,
		isPending: false,
		mutateAsync,
	}),
}));

describe("ProjectBriefCard", () => {
	beforeEach(() => vi.clearAllMocks());

	it("lets a workspace manager add persisted project instructions", async () => {
		render(<ProjectBriefCard canManage instructions="" projectId="project-1" />);

		fireEvent.click(screen.getByRole("button", { name: "Add project brief" }));
		fireEvent.change(screen.getByLabelText("Project brief"), {
			target: { value: "Use British English and cite primary sources." },
		});
		fireEvent.click(screen.getByRole("button", { name: "Save brief" }));

		await waitFor(() =>
			expect(mutateAsync).toHaveBeenCalledWith({
				projectId: "project-1",
				input: { instructions: "Use British English and cite primary sources." },
			}),
		);
	});
});
