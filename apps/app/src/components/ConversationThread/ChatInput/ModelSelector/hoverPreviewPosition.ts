interface HoverPreviewPosition {
	left: number;
	top: number;
	width: number;
	maxHeight: number;
	anchorTop?: number;
	frameTop?: number;
	frameBottom?: number;
}

const HOVER_PREVIEW_WIDTH = 320;
const HOVER_PREVIEW_HEIGHT = 460;
const HOVER_PREVIEW_GUTTER = 12;
const HOVER_PREVIEW_EDGE = 8;

export function clampHoverPreviewTop({
	anchorTop,
	previewHeight,
	frameTop,
	frameBottom,
}: {
	anchorTop: number;
	previewHeight: number;
	frameTop: number;
	frameBottom: number;
}) {
	return Math.max(frameTop, Math.min(anchorTop, frameBottom - previewHeight));
}

export function getHoverPreviewPosition(
	anchorRect: DOMRect,
	frameRect?: DOMRect | null,
): HoverPreviewPosition | null {
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

	const viewportMaxHeight = Math.max(0, viewportHeight - HOVER_PREVIEW_EDGE * 2);
	const frameTop = frameRect ? Math.max(frameRect.top, HOVER_PREVIEW_EDGE) : null;
	const frameBottom = frameRect
		? Math.min(frameRect.bottom, viewportHeight - HOVER_PREVIEW_EDGE)
		: null;
	const frameHeight =
		frameTop !== null && frameBottom !== null ? Math.max(0, frameBottom - frameTop) : null;

	if (frameHeight !== null && frameTop !== null && frameBottom !== null) {
		const minimumUsefulHeight = Math.min(HOVER_PREVIEW_HEIGHT, frameHeight);
		const top = clampHoverPreviewTop({
			anchorTop: anchorRect.top,
			previewHeight: minimumUsefulHeight,
			frameTop,
			frameBottom,
		});
		return {
			left,
			top,
			width,
			maxHeight: frameBottom - top,
			anchorTop: anchorRect.top,
			frameTop,
			frameBottom,
		};
	}

	const maxPreviewHeight = Math.min(HOVER_PREVIEW_HEIGHT, viewportMaxHeight);
	const top = Math.min(
		Math.max(anchorRect.top - 40, HOVER_PREVIEW_EDGE),
		Math.max(HOVER_PREVIEW_EDGE, viewportHeight - maxPreviewHeight - HOVER_PREVIEW_EDGE),
	);

	return { left, top, width, maxHeight: maxPreviewHeight };
}
