import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";

import { ProductModeSwitch } from "./ProductModeSwitch";

function CurrentPath() {
	return <output aria-label="Current product route">{useLocation().pathname}</output>;
}

function renderModeSwitch(pathname: string) {
	return render(
		<MemoryRouter initialEntries={[pathname]}>
			<ProductModeSwitch />
			<CurrentPath />
		</MemoryRouter>,
	);
}

describe("ProductModeSwitch", () => {
	it("keeps nested project routes in Work mode and returns directly to clean Chat mode", () => {
		renderModeSwitch("/work/workspace-1/projects/project-1/library");

		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Chat" })).not.toHaveAttribute("aria-current");
		expect(screen.getByRole("link", { name: "Chat" })).toHaveClass("no-underline");
		expect(screen.getByRole("link", { name: "Work" })).toHaveClass("no-underline");
		expect(screen.getByRole("link", { name: "Chat" }).querySelector("svg")).not.toBeNull();
		expect(screen.getByRole("link", { name: "Work" }).querySelector("svg")).not.toBeNull();

		fireEvent.click(screen.getByRole("link", { name: "Chat" }));

		expect(screen.getByLabelText("Current product route")).toHaveTextContent("/chat");
		expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Work" })).not.toHaveAttribute("aria-current");
	});

	it("enters Work mode at the workspace index rather than carrying chat state across", () => {
		renderModeSwitch("/chat");

		fireEvent.click(screen.getByRole("link", { name: "Work" }));

		expect(screen.getByLabelText("Current product route")).toHaveTextContent("/work");
		expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page");
	});
});
