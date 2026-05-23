import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ComposerModeMenu } from "./ComposerModeMenu";

describe("ComposerModeMenu", () => {
	it("opens current mode controls and mode switching options from one trigger", () => {
		render(
			<ComposerModeMenu
				menu={
					<>
						<div>Sandbox controls</div>
						<button type="button">Council mode</button>
					</>
				}
				trigger={<span aria-hidden="true">S</span>}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Open chat mode controls" }));

		expect(screen.getByText("Sandbox controls")).toBeInTheDocument();
		expect(screen.getByText("Modes")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Council mode" })).toBeInTheDocument();
	});
});
