import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavigationList, ProductModeSwitch, type NavigationItem } from "./index";

afterEach(cleanup);

describe("navigation controls", () => {
	it("reports the selected product mode without owning mode state", () => {
		const onSelect = vi.fn();
		render(<ProductModeSwitch activeMode="chat" onSelect={onSelect} />);

		const chatControl = screen.getByRole("button", { name: "Chat" });
		const workControl = screen.getByRole("button", { name: "Work" });
		expect(chatControl.getAttribute("aria-pressed")).toBe("true");
		expect(chatControl.querySelector("svg")).not.toBeNull();
		expect(workControl.querySelector("svg")).not.toBeNull();
		fireEvent.click(workControl);
		expect(onSelect).toHaveBeenCalledWith("work");
		expect(screen.getByRole("button", { name: "Chat" }).getAttribute("aria-pressed")).toBe("true");
	});

	it("keeps unavailable navigation destinations inert", () => {
		const items: NavigationItem[] = [
			{ id: "home", label: "Home" },
			{ id: "admin", label: "Admin", disabledReason: "Administrators only" },
		];
		const onSelect = vi.fn();
		render(
			<NavigationList
				items={items}
				activeItemId="home"
				ariaLabel="Workspace"
				onSelect={onSelect}
			/>,
		);

		const unavailable = screen.getByRole("button", { name: "Admin" });
		expect(unavailable.hasAttribute("disabled")).toBe(true);
		expect(unavailable.title).toBe("Administrators only");
		fireEvent.click(unavailable);
		expect(onSelect).not.toHaveBeenCalled();
	});
});
