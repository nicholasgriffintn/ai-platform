import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ToolSelector } from "./ToolSelector";

const mocks = vi.hoisted(() => ({
	setDefaultTools: vi.fn(),
}));

vi.mock("~/hooks/useTools", () => ({
	useTools: () => ({
		data: [
			{
				id: "web_search",
				name: "Web search",
				description: "Search the web",
				isDefault: true,
			},
		],
		isLoading: false,
	}),
}));

vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: () => ({
		defaultTools: [],
		resetToDefaults: vi.fn(),
		selectedTools: [],
		setDefaultTools: mocks.setDefaultTools,
		toggleTool: vi.fn(),
	}),
}));

describe("ToolSelector", () => {
	it("initialises default tools after render", async () => {
		render(<ToolSelector />);

		await waitFor(() => {
			expect(mocks.setDefaultTools).toHaveBeenCalledWith([
				expect.objectContaining({
					id: "web_search",
				}),
			]);
		});
	});
});
