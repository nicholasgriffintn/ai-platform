interface HoverPreviewPosition {
	left: number;
	top: number;
	width: number;
}

const HOVER_PREVIEW_WIDTH = 320;
const HOVER_PREVIEW_HEIGHT = 460;
const HOVER_PREVIEW_GUTTER = 12;
const HOVER_PREVIEW_EDGE = 8;

export function getHoverPreviewPosition(anchorRect: DOMRect): HoverPreviewPosition | null {
	if (typeof window === "undefined") {
		return null;
	}

	const viewportWidth = window.innerWidth;
	const viewportHeight = window.innerHeight;
	const availableWidth = Math.max(0, viewportWidth - HOVER_PREVIEW_EDGE * 2);
	const width =
		viewportWidth < 640 ? availableWidth : Math.min(HOVER_PREVIEW_WIDTH, availableWidth);

	if (width <= 0) {
		return null;
	}

	const requiredSpace = width + HOVER_PREVIEW_GUTTER + HOVER_PREVIEW_EDGE;
	const spaceOnRight = viewportWidth - anchorRect.right;
	const spaceOnLeft = anchorRect.left;

	let left: number;
	if (spaceOnRight >= requiredSpace) {
		left = anchorRect.right + HOVER_PREVIEW_GUTTER;
	} else if (spaceOnLeft >= requiredSpace) {
		left = anchorRect.left - width - HOVER_PREVIEW_GUTTER;
	} else {
		left = Math.max(
			HOVER_PREVIEW_EDGE,
			Math.min(viewportWidth - width - HOVER_PREVIEW_EDGE, anchorRect.left),
		);
	}

	const maxPreviewHeight = Math.min(
		HOVER_PREVIEW_HEIGHT,
		Math.max(0, viewportHeight - HOVER_PREVIEW_EDGE * 2),
	);
	const top = Math.min(
		Math.max(anchorRect.top - 40, HOVER_PREVIEW_EDGE),
		Math.max(HOVER_PREVIEW_EDGE, viewportHeight - maxPreviewHeight - HOVER_PREVIEW_EDGE),
	);

	return { left, top, width };
}
