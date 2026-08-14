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

		expect(dialog.style.width).toBe("840px");
		expect(dialog.style.maxWidth).toBe("calc(100vw - 2rem)");
	});

	it("owns its theme-aware surface and text colours inside the portal", () => {
		render(
			<Dialog open>
				<DialogContent>
					<DialogTitle>Share Conversation</DialogTitle>
				</DialogContent>
			</Dialog>,
		);

		const dialog = screen.getByRole("dialog", { name: "Share Conversation" });
		const title = screen.getByRole("heading", { name: "Share Conversation" });

		expect(dialog.className).toContain("bg-background");
		expect(dialog.className).toContain("text-foreground");
		expect(dialog.className).toContain("border-border");
		expect(title.className).toContain("text-foreground");
	});
});
