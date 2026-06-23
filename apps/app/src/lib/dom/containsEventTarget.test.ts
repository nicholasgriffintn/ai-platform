import { describe, expect, it } from "vitest";

import { containsEventTarget } from "./containsEventTarget";

describe("containsEventTarget", () => {
	it("detects descendant event targets", () => {
		const root = document.createElement("div");
		const child = document.createElement("a");
		root.appendChild(child);

		expect(containsEventTarget(root, child)).toBe(true);
	});

	it("rejects targets outside the element", () => {
		const root = document.createElement("div");
		const outside = document.createElement("a");

		expect(containsEventTarget(root, outside)).toBe(false);
	});

	it("handles missing elements and non-node targets", () => {
		expect(containsEventTarget(null, document.createElement("a"))).toBe(false);
		expect(containsEventTarget(document.createElement("div"), new EventTarget())).toBe(false);
	});
});
