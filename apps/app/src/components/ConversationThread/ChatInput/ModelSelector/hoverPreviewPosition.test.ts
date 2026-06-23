import { describe, expect, it, vi } from "vitest";

import { getHoverPreviewPosition } from "./hoverPreviewPosition";

function setViewport(width: number, height: number) {
	vi.stubGlobal("innerWidth", width);
	vi.stubGlobal("innerHeight", height);
}

function rect(left: number, right: number, top: number): DOMRect {
	return {
		left,
		right,
		top,
		bottom: top + 24,
		width: right - left,
		height: 24,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

describe("getHoverPreviewPosition", () => {
	it("places the preview to the left when the right edge has no room", () => {
		setViewport(900, 700);

		expect(getHoverPreviewPosition(rect(820, 860, 120))).toMatchObject({
			left: 488,
			top: 80,
			width: 320,
		});
	});

	it("uses a constrained full-width preview on narrow screens", () => {
		setViewport(360, 640);

		expect(getHoverPreviewPosition(rect(290, 320, 520))).toMatchObject({
			left: 8,
			top: 172,
			width: 344,
		});
	});
});
