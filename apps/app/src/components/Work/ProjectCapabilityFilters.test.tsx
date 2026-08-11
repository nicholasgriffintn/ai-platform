import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectCapabilityFilters } from "./ProjectCapabilityFilters";

describe("ProjectCapabilityFilters", () => {
	it("supports search, type, and responsive category controls", () => {
		const onCategoryChange = vi.fn();
		const onKindChange = vi.fn();
		const onQueryChange = vi.fn();

		render(
			<ProjectCapabilityFilters
				categories={["Agents & Delegation", "Calendar", "Data & Utilities"]}
				category="Calendar"
				kind="all"
				onCategoryChange={onCategoryChange}
				onKindChange={onKindChange}
				onQueryChange={onQueryChange}
				query=""
			/>,
		);

		fireEvent.change(screen.getByRole("searchbox", { name: "Search project capabilities" }), {
			target: { value: "calendar" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Apps" }));
		fireEvent.click(screen.getByRole("button", { name: "Data & Utilities" }));
		fireEvent.change(screen.getByRole("combobox", { name: "Filter capabilities by category" }), {
			target: { value: "Agents & Delegation" },
		});

		expect(onQueryChange).toHaveBeenCalledWith("calendar");
		expect(onKindChange).toHaveBeenCalledWith("app");
		expect(onCategoryChange).toHaveBeenNthCalledWith(1, "Data & Utilities");
		expect(onCategoryChange).toHaveBeenNthCalledWith(2, "Agents & Delegation");
		expect(screen.getByRole("button", { name: "Calendar" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		expect(screen.getByRole("combobox", { name: "Filter capabilities by category" })).toHaveValue(
			"Calendar",
		);
	});
});
