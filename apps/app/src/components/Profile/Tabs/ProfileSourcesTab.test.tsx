import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SourcesLibrary } from "./ProfileSourcesTab";

const mocks = vi.hoisted(() => ({
	deleteSource: vi.fn(async () => undefined),
}));

vi.mock("~/hooks/useSources", () => ({
	useSources: () => ({
		data: [
			{
				id: "source-1",
				kind: "text",
				title: "Product brief",
				createdAt: "2026-08-11T12:00:00.000Z",
				updatedAt: "2026-08-11T12:00:00.000Z",
			},
		],
		error: null,
		isLoading: false,
	}),
	useSourceCollections: () => ({ data: [] }),
	useSourceMutations: () => ({
		addToCollection: { mutate: vi.fn() },
		createCollection: { isPending: false, mutateAsync: vi.fn() },
		createSource: { isPending: false, mutateAsync: vi.fn() },
		deleteCollection: { isPending: false, mutateAsync: vi.fn() },
		deleteSource: { isPending: false, mutateAsync: mocks.deleteSource },
	}),
}));

vi.mock("../MemorySynthesisPanel", () => ({
	MemorySynthesisPanel: () => <div>Memory synthesis</div>,
}));

describe("SourcesLibrary", () => {
	it("uses the standard page action and confirms destructive source removal", async () => {
		render(<SourcesLibrary title="Sources" />);

		expect(screen.getByText("Memory synthesis")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Add source" }));
		expect(screen.getByRole("dialog", { name: "Add source" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
		fireEvent.click(screen.getByRole("button", { name: "Delete Product brief" }));
		expect(screen.getByRole("dialog", { name: "Delete source" })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Delete source" }));
		expect(mocks.deleteSource).toHaveBeenCalledWith("source-1");
	});

	it("does not add a second source creation flow to project pages", () => {
		render(<SourcesLibrary projectId="project-1" title="Sources" />);

		expect(screen.queryByRole("button", { name: "Add source" })).not.toBeInTheDocument();
	});
});
