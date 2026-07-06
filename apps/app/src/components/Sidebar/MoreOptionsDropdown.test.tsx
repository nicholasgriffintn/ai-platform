import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { MoreOptionsDropdown } from "./MoreOptionsDropdown";

vi.mock("react-router", () => ({
	Link: ({
		children,
		className,
		to,
		...props
	}: {
		children: ReactNode;
		className?: string;
		to: string;
	}) => (
		<a className={className} href={to} {...props}>
			{children}
		</a>
	),
}));

describe("MoreOptionsDropdown", () => {
	it("renders navigation menu items as links, not nested controls", () => {
		render(<MoreOptionsDropdown onShowKeyboardShortcuts={vi.fn()} />);

		fireEvent.click(screen.getByRole("button", { name: "More options" }));

		for (const name of ["Terms", "Privacy", /GitHub/]) {
			const link = screen.getByRole("menuitem", { name });

			expect(link.tagName).toBe("A");
			expect(link.closest("button")).toBeNull();
		}
	});
});
