export interface SelectionActionPosition {
	top: number;
	left: number;
}

interface MeasureTextareaSelectionActionPositionArgs {
	textarea: HTMLTextAreaElement;
	container: HTMLElement;
	content: string;
	selectionStart: number;
	selectionEnd: number;
}

const ACTION_WIDTH = 230;
const ACTION_HEIGHT = 36;
const ACTION_GAP = 8;
const EDGE_INSET = 12;

export function measureTextareaSelectionActionPosition({
	textarea,
	container,
	content,
	selectionStart,
	selectionEnd,
}: MeasureTextareaSelectionActionPositionArgs): SelectionActionPosition {
	const document = textarea.ownerDocument;
	const mirror = createTextareaMirror(textarea);
	const start = Math.min(selectionStart, selectionEnd);
	const end = Math.max(selectionStart, selectionEnd);
	const startMarker = document.createElement("span");
	const endMarker = document.createElement("span");

	startMarker.dataset.selectionMarker = "start";
	endMarker.dataset.selectionMarker = "end";
	startMarker.textContent = "\u200b";
	endMarker.textContent = "\u200b";
	mirror.appendChild(document.createTextNode(content.slice(0, start)));
	mirror.appendChild(startMarker);
	mirror.appendChild(document.createTextNode(content.slice(start, end)));
	mirror.appendChild(endMarker);
	mirror.appendChild(document.createTextNode(content.slice(end) || "\u200b"));
	document.body.appendChild(mirror);

	try {
		const startRect = startMarker.getBoundingClientRect();
		const endRect = endMarker.getBoundingClientRect();
		const containerRect = container.getBoundingClientRect();
		const textareaRect = textarea.getBoundingClientRect();
		const selectionTop = Math.min(startRect.top, endRect.top);
		const selectionBottom = Math.max(startRect.bottom, endRect.bottom);
		const visibleTop = textareaRect.top - containerRect.top + EDGE_INSET;
		const visibleBottom = textareaRect.bottom - containerRect.top - EDGE_INSET;
		const maxTop = Math.max(visibleTop, visibleBottom - ACTION_HEIGHT);
		const left = clamp(
			Math.min(startRect.left, endRect.left) - containerRect.left,
			EDGE_INSET,
			Math.max(EDGE_INSET, container.clientWidth - ACTION_WIDTH - EDGE_INSET),
		);
		const belowTop = selectionBottom - containerRect.top + ACTION_GAP;
		const aboveTop = selectionTop - containerRect.top - ACTION_HEIGHT - ACTION_GAP;
		const top = belowTop <= maxTop ? belowTop : aboveTop >= visibleTop ? aboveTop : maxTop;

		return {
			top: clamp(top, visibleTop, maxTop),
			left,
		};
	} finally {
		mirror.remove();
	}
}

function createTextareaMirror(textarea: HTMLTextAreaElement): HTMLDivElement {
	const document = textarea.ownerDocument;
	const window = document.defaultView;
	const style = window?.getComputedStyle(textarea);
	const rect = textarea.getBoundingClientRect();
	const scrollX = window?.scrollX ?? 0;
	const scrollY = window?.scrollY ?? 0;
	const mirror = document.createElement("div");

	Object.assign(mirror.style, {
		position: "absolute",
		visibility: "hidden",
		pointerEvents: "none",
		whiteSpace: "pre-wrap",
		overflowWrap: "break-word",
		wordWrap: "break-word",
		top: `${rect.top + scrollY - textarea.scrollTop}px`,
		left: `${rect.left + scrollX - textarea.scrollLeft}px`,
		width: `${rect.width}px`,
		boxSizing: style?.boxSizing,
		border: style?.border,
		padding: style?.padding,
		font: style?.font,
		fontFamily: style?.fontFamily,
		fontSize: style?.fontSize,
		fontWeight: style?.fontWeight,
		letterSpacing: style?.letterSpacing,
		lineHeight: style?.lineHeight,
		tabSize: style?.tabSize,
	});

	return mirror;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
