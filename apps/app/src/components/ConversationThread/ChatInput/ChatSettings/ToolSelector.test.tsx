import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ToolSelector } from "./ToolSelector";

const mocks = vi.hoisted(() => ({
	setDefaultTools: vi.fn(),
	toggleTool: vi.fn(),
}));

vi.mock("~/hooks/useTools", () => ({
	useTools: () => ({
		data: [
			{
				id: "web_search",
				name: "Web search",
				description: "Search the web",
				category: "Research",
				isDefault: true,
			},
			{
				id: "create_image",
				name: "Create image",
				description: "Generate an illustration",
				category: "Creative",
				isDefault: false,
			},
			{
				id: "create_note",
				name: "Create note",
				description: "Save information",
				category: "Productivity",
				isDefault: false,
			},
		],
		isLoading: false,
	}),
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: () => ({
		defaultTools: [],
		resetToDefaults: vi.fn(),
		selectedTools: ["create_image"],
		setDefaultTools: mocks.setDefaultTools,
		toggleTool: mocks.toggleTool,
	}),
}));

describe("ToolSelector", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("initialises default tools after render", async () => {
		render(<ToolSelector />);

		await waitFor(() => {
			expect(mocks.setDefaultTools).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						id: "web_search",
					}),
				]),
			);
		});
	});

	it("searches tool names and descriptions", () => {
		render(<ToolSelector />);

		fireEvent.click(screen.getByRole("button", { name: "Manage AI tools" }));
		fireEvent.change(screen.getByRole("searchbox", { name: "Search tools" }), {
			target: { value: "illustration" },
		});

		expect(screen.getByText("Create image")).toBeInTheDocument();
		expect(screen.queryByText("Web search")).not.toBeInTheDocument();
		expect(screen.getByText("1 tool")).toBeInTheDocument();
	});

	it("filters tools by category and selected state", () => {
		render(<ToolSelector />);

		fireEvent.click(screen.getByRole("button", { name: "Manage AI tools" }));
		fireEvent.click(screen.getByRole("button", { name: "Research" }));

		expect(screen.getByText("Web search")).toBeInTheDocument();
		expect(screen.queryByText("Create image")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", { name: "Selected" }));

		expect(screen.getByText("Create image")).toBeInTheDocument();
		expect(screen.queryByText("Web search")).not.toBeInTheDocument();
	});

	it("keeps filtered tools selectable", () => {
		render(<ToolSelector />);

		fireEvent.click(screen.getByRole("button", { name: "Manage AI tools" }));
		fireEvent.click(screen.getByRole("button", { name: "Creative" }));
		fireEvent.click(screen.getByRole("checkbox", { name: /Create image/i }));

		expect(mocks.toggleTool).toHaveBeenCalledWith("create_image");
	});
});
