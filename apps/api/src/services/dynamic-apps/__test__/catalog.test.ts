import { describe, expect, it } from "vitest";

import { getDynamicAppCatalog } from "../index";

describe("dynamic app catalog", () => {
	it("includes featured frontend apps from the service catalog", async () => {
		await expect(getDynamicAppCatalog()).resolves.toContainEqual(
			expect.objectContaining({
				id: "featured-strudel",
				featured: true,
				kind: "frontend",
				href: "/apps/strudel",
			}),
		);
	});
});
