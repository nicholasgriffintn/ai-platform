import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CapabilityCard, CapabilityFilters, type CapabilityCardModel } from "./index";

afterEach(cleanup);

describe("capability controls", () => {
	it("reports controlled filter changes without owning filter state", () => {
		const onCategoryChange = vi.fn();
		const onKindChange = vi.fn();
		const onQueryChange = vi.fn();
		render(
			<CapabilityFilters
				categories={["Research"]}
				category="all"
				kind="all"
				query=""
				onCategoryChange={onCategoryChange}
				onKindChange={onKindChange}
				onQueryChange={onQueryChange}
			/>,
		);

		fireEvent.change(screen.getByRole("searchbox"), { target: { value: "weather" } });
		fireEvent.click(screen.getByRole("button", { name: "Apps" }));
		fireEvent.change(screen.getByRole("combobox"), { target: { value: "Research" } });

		expect(onQueryChange).toHaveBeenCalledWith("weather");
		expect(onKindChange).toHaveBeenCalledWith("app");
		expect(onCategoryChange).toHaveBeenCalledWith("Research");
		expect(screen.getByRole<HTMLInputElement>("searchbox").value).toBe("");
	});

	it("does not launch an unavailable capability", () => {
		const onLaunch = vi.fn<(capability: CapabilityCardModel) => void>();
		const capability: CapabilityCardModel = {
			id: "reports",
			name: "Reports",
			description: "Generate reports",
			kind: "app",
			available: false,
			unavailableReason: "Connect a data source first",
		};
		render(<CapabilityCard capability={capability} onLaunch={onLaunch} />);

		const launch = screen.getByRole("button", { name: "Open" });
		expect(launch.hasAttribute("disabled")).toBe(true);
		expect(launch.title).toBe("Connect a data source first");
		fireEvent.click(launch);
		expect(onLaunch).not.toHaveBeenCalled();
	});
});
