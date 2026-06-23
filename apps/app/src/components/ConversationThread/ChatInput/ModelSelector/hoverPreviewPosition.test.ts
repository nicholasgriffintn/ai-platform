import { describe, expect, it, vi } from "vitest";

import { clampHoverPreviewTop, getHoverPreviewPosition } from "./hoverPreviewPosition";

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
	it("keeps measured previews aligned to the row when the content fits", () => {
		expect(
			clampHoverPreviewTop({
				anchorTop: 520,
				previewHeight: 200,
				frameTop: 96,
				frameBottom: 760,
			}),
		).toBe(520);
	});

	it("clamps measured previews upward only when they would exceed the selector", () => {
		expect(
			clampHoverPreviewTop({
				anchorTop: 520,
				previewHeight: 300,
				frameTop: 96,
				frameBottom: 760,
			}),
		).toBe(460);
	});

	it("uses the selector top when measured previews are taller than the selector", () => {
		expect(
			clampHoverPreviewTop({
				anchorTop: 520,
				previewHeight: 800,
				frameTop: 96,
				frameBottom: 760,
			}),
		).toBe(96);
	});

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

	it("aligns framed previews with the hovered row when there is room below", () => {
		setViewport(1280, 900);

		const position = getHoverPreviewPosition(rect(820, 860, 180), frameRect(96, 760));

		expect(position).toMatchObject({
			top: 180,
			maxHeight: 580,
			anchorTop: 180,
			frameTop: 96,
			frameBottom: 760,
		});
	});

	it("shifts framed previews upward when row alignment would exceed the selector", () => {
		setViewport(1280, 900);

		const position = getHoverPreviewPosition(rect(820, 860, 520), frameRect(96, 760));

		expect(position).toMatchObject({
			top: 300,
			maxHeight: 460,
		});
		expect(position?.top).toBeLessThan(520);
	});

	it("keeps framed previews inside viewport-clamped selector edges", () => {
		setViewport(1280, 640);

		const position = getHoverPreviewPosition(rect(820, 860, 520), frameRect(-40, 700));

		expect(position).toMatchObject({
			top: 172,
			maxHeight: 460,
		});
		expect(
			position && position.top !== undefined ? position.top + position.maxHeight : Infinity,
		).toBe(632);
	});

	it("uses the whole selector height when the selector is shorter than the preferred preview", () => {
		setViewport(1280, 640);

		const position = getHoverPreviewPosition(rect(820, 860, 300), frameRect(120, 380));

		expect(position).toMatchObject({
			top: 120,
			maxHeight: 260,
		});
		expect(
			position && position.top !== undefined ? position.top + position.maxHeight : Infinity,
		).toBe(380);
	});

	it("can grow up to the selector height from high rows", () => {
		setViewport(1280, 900);

		const position = getHoverPreviewPosition(rect(820, 860, 100), frameRect(96, 760));

		expect(position).toMatchObject({
			top: 100,
			maxHeight: 660,
		});
		expect(position ? position.maxHeight : 0).toBeGreaterThan(460);
	});
});
