import { afterEach, describe, expect, it, vi } from "vitest";

import { measureTextareaSelectionActionPosition } from "../textarea-selection-position";

function rect({
	top,
	left,
	width,
	height,
}: {
	top: number;
	left: number;
	width: number;
	height: number;
}): DOMRect {
	return {
		top,
		left,
		width,
		height,
		bottom: top + height,
		right: left + width,
		x: left,
		y: top,
		toJSON: () => ({}),
	} as DOMRect;
}

describe("textarea selection position", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("anchors the action to the measured selection and keeps it visible", () => {
		const container = document.createElement("div");
		const textarea = document.createElement("textarea");
		document.body.appendChild(container);
		document.body.appendChild(textarea);
		Object.defineProperty(container, "clientWidth", { configurable: true, value: 400 });

		const containerRect = rect({ top: 100, left: 20, width: 400, height: 400 });
		const textareaRect = rect({ top: 120, left: 40, width: 360, height: 300 });
		const startMarkerRect = rect({ top: 360, left: 100, width: 1, height: 20 });
		const endMarkerRect = rect({ top: 360, left: 160, width: 1, height: 20 });

		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
			function (this: Element) {
				if (this === container) return containerRect;
				if (this === textarea) return textareaRect;
				if (this instanceof HTMLSpanElement && this.dataset.selectionMarker === "start") {
					return startMarkerRect;
				}
				if (this instanceof HTMLSpanElement && this.dataset.selectionMarker === "end") {
					return endMarkerRect;
				}
				return rect({ top: 0, left: 0, width: 0, height: 0 });
			},
		);

		expect(
			measureTextareaSelectionActionPosition({
				textarea,
				container,
				content: "Line one\nLine two\nBest regards,",
				selectionStart: 18,
				selectionEnd: 31,
			}),
		).toEqual({
			top: 216,
			left: 80,
		});
	});
});
