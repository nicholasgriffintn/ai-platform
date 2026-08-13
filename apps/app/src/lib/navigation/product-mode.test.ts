import { describe, expect, it } from "vitest";

import { isProductModeRoute } from "./product-mode";

describe("isProductModeRoute", () => {
	it.each(["/", "/chat", "/chat/conversation", "/work", "/work/workspace-1"])(
		"shows the product mode switch on %s",
		(pathname) => {
			expect(isProductModeRoute(pathname)).toBe(true);
		},
	);

	it.each(["/profile", "/privacy", "/chatty", "/worker", "/s/shared-1"])(
		"hides the product mode switch on %s",
		(pathname) => {
			expect(isProductModeRoute(pathname)).toBe(false);
		},
	);
});
