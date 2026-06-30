import { describe, expect, it } from "vitest";

import { formatUtcDateKey } from "../date";

describe("date utilities", () => {
	it("formats a stable UTC date key", () => {
		expect(formatUtcDateKey(new Date("2026-06-07T23:59:59.000Z"))).toBe("2026-06-07");
	});
});
