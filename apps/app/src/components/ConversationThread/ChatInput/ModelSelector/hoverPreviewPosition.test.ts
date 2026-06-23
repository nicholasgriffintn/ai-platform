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

function frameRect(top: number, bottom: number): DOMRect {
	return {
		left: 120,
		right: 780,
		top,
		bottom,
		width: 660,
		height: bottom - top,
		x: 120,
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
			maxHeight: 460,
		});
	});

	it("keeps the preview height inside short viewports", () => {
		setViewport(900, 380);

		const position = getHoverPreviewPosition(rect(520, 560, 300));

		expect(position).toMatchObject({
			top: 8,
			maxHeight: 364,
		});
		expect(position?.top).toBeTypeOf("number");
		expect(
			position && position.top !== undefined ? position.top + position.maxHeight : Infinity,
		).toBeLessThanOrEqual(372);
	});

	it("uses the model selector frame for vertical placement when provided", () => {
		setViewport(1280, 900);

		const position = getHoverPreviewPosition(rect(820, 860, 520), frameRect(96, 760));

		expect(position).toMatchObject({
			bottom: 140,
			maxHeight: 664,
		});
		expect(position?.top).toBeUndefined();
	});

	it("clamps the selector-aligned preview to viewport edges", () => {
		setViewport(1280, 640);

		const position = getHoverPreviewPosition(rect(820, 860, 520), frameRect(-40, 700));

		expect(position).toMatchObject({
			bottom: 8,
			maxHeight: 624,
		});
		expect(position?.top).toBeUndefined();
	});
});
