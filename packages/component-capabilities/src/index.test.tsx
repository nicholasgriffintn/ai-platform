import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityFilters } from "./index";

afterEach(cleanup);

describe("capability controls", () => {
	it("reports controlled filter changes without owning filter state", () => {
		const onCategoryChange = vi.fn();
		const onFiltersChange = vi.fn();
		const onQueryChange = vi.fn();
		render(
			<CapabilityFilters
				categories={["Research"]}
				category="all"
				filters={["configured"]}
				query=""
				onCategoryChange={onCategoryChange}
				onFiltersChange={onFiltersChange}
				onQueryChange={onQueryChange}
			/>,
		);

		fireEvent.change(screen.getByRole("searchbox"), { target: { value: "weather" } });
		fireEvent.click(screen.getByRole("button", { name: "Recipes" }));
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "Research" } });

		expect(onQueryChange).toHaveBeenCalledWith("weather");
		expect(onFiltersChange).toHaveBeenCalledWith(["configured", "recipe"]);
		expect(onCategoryChange).toHaveBeenCalledWith("Research");
		expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("");
	});

	it("preserves the compact selected and hoverable filter variants", () => {
		render(
			<CapabilityFilters
				categories={["Research"]}
				category="Research"
				filters={["app", "recipe"]}
				query=""
				onCategoryChange={vi.fn()}
				onFiltersChange={vi.fn()}
				onQueryChange={vi.fn()}
			/>,
		);

		const apps = screen.getByRole("button", { name: "Apps" });
		const all = screen.getByRole("button", { name: "All" });
		const research = screen.getByRole("button", { name: "Research" });

		expect(apps.className).toContain("px-3 py-1.5 text-xs");
		expect(apps.className).toContain("dark:bg-zinc-100");
		expect(all.className).toContain("dark:hover:bg-zinc-800");
		expect(research.className).toContain("dark:bg-zinc-800");
	});
});
