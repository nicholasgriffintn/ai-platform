import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "./Dialog";

describe("Dialog", () => {
	it("applies the root width prop to content without exceeding the viewport", () => {
		render(
			<Dialog open width="840px">
				<DialogContent>
					<DialogTitle>Keyboard Shortcuts</DialogTitle>
				</DialogContent>
			</Dialog>,
		);

		const dialog = screen.getByRole("dialog", { name: "Keyboard Shortcuts" });

		expect(dialog).toHaveStyle({
			width: "840px",
			maxWidth: "calc(100vw - 2rem)",
		});
	});
});
