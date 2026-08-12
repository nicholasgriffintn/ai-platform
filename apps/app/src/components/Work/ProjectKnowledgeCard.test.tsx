import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectKnowledgeCard } from "./ProjectKnowledgeCard";

vi.mock("~/hooks/useSources", () => ({
	useSources: ({ kind }: { kind?: string }) => ({
		data:
			kind === "memory"
				? [{ id: "memory-1", kind: "memory", title: "Launch is Friday", status: "available" }]
				: [],
	}),
	useProjectContextSources: () => ({ data: [] }),
	useSetProjectContextSources: () => ({ isPending: false, mutateAsync: vi.fn() }),
	useSourceMutations: () => ({
		createSource: { isPending: false, mutateAsync: vi.fn() },
	}),
}));

describe("ProjectKnowledgeCard", () => {
	it("shows memories created by project conversations without a manual memory form", () => {
		render(
			<MemoryRouter>
				<ProjectKnowledgeCard workspaceId="workspace-1" projectId="project-1" canManage />
			</MemoryRouter>,
		);

		expect(screen.getByText("Launch is Friday")).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Add project memory" })).not.toBeInTheDocument();
	});
});
