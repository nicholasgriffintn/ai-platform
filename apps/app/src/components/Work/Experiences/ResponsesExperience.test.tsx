import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ResponsesExperience } from "./ResponsesExperience";

const revokeShare = vi.fn();

vi.mock("~/components/Apps/ResponseRenderer", () => ({
	ResponseRenderer: () => <div>Rendered output</div>,
}));

vi.mock("~/hooks/useOutputs", () => ({
	useOutputs: () => ({ data: [], isLoading: false, error: null }),
	useOutput: () => ({
		data: {
			id: "output-1",
			capabilityId: "notes",
			title: "Launch notes",
			content: {},
		},
		isLoading: false,
		error: null,
	}),
	useOutputShares: () => ({
		data: [
			{
				id: "share-1",
				outputId: "output-1",
				permission: "view",
				expiresAt: null,
				revokedAt: null,
				createdAt: "2026-08-11T11:00:00.000Z",
			},
		],
	}),
	useCreateOutputShare: () => ({ isPending: false, mutateAsync: vi.fn() }),
	useRevokeOutputShare: () => ({ isPending: false, mutate: revokeShare, variables: undefined }),
}));

describe("ResponsesExperience", () => {
	it("revokes an active share through the output interface", () => {
		render(
			<MemoryRouter>
				<ResponsesExperience
					basePath="/work/workspace-1/projects/project-1/outputs"
					projectId="project-1"
					subpath="output-1"
				/>
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

		expect(revokeShare).toHaveBeenCalledWith({ outputId: "output-1", shareId: "share-1" });
	});
});
