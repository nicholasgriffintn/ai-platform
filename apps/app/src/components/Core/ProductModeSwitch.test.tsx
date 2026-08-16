import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { ProductModeSwitch } from "./ProductModeSwitch";

afterEach(cleanup);

describe("ProductModeSwitch", () => {
	it("highlights Chat on the root conversation route", () => {
		render(
			<MemoryRouter initialEntries={["/"]}>
				<ProductModeSwitch />
			</MemoryRouter>,
		);

		expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
		expect(screen.getByRole("link", { name: "Work" })).not.toHaveAttribute("aria-current");
	});
});
