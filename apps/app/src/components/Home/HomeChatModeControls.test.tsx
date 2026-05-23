import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HomeChatModeMenu } from "./HomeChatModeControls";

describe("HomeChatModeMenu", () => {
	it("renders active mode controls inside the active mode item", () => {
		render(
			<HomeChatModeMenu
				activeModeControls={<div>Sandbox controls</div>}
				activeModeId="sandbox"
				onModeChange={vi.fn()}
			/>,
		);

		const activeButton = screen
			.getAllByRole("button")
			.find((button) => button.getAttribute("aria-pressed") === "true");

		expect(activeButton).toHaveTextContent("Sandbox");
		expect(screen.getByText("Sandbox controls")).toBeInTheDocument();
	});
});
