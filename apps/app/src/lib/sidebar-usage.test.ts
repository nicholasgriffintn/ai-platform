import { describe, expect, it } from "vitest";

import { getBoundedUsagePercentage } from "./sidebar-usage";

describe("getBoundedUsagePercentage", () => {
	it("keeps usage progress widths inside the track", () => {
		expect(getBoundedUsagePercentage(75, 100)).toBe(75);
		expect(getBoundedUsagePercentage(225, 100)).toBe(100);
		expect(getBoundedUsagePercentage(-5, 100)).toBe(0);
		expect(getBoundedUsagePercentage(10, 0)).toBe(0);
	});
});
