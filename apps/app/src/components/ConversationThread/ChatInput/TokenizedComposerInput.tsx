import {
	type ClipboardEvent,
	type KeyboardEvent,
	forwardRef,
	useImperativeHandle,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react";

import { getComposerInlineTokenText } from "~/lib/composer-commands";
import { cn } from "~/lib/utils";

interface TokenizedComposerInputProps {
	id: string;
	value: string;
	tokens?: ComposerInputToken[];
	placeholder: string;
	ariaLabel: string;
	ariaDescribedBy?: string;
	disabled?: boolean;
	className?: string;
	onChange: (value: string) => void;
	onCursorPositionChange: (position: number) => void;
	onTokenPositionsChange: (positions: ComposerInputTokenPosition[]) => void;
	onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
}

export interface ComposerInputToken {
	id: string;
	kind: "action" | "agent" | "skill" | "tool";
	label: string;
	position: number;
}

export interface ComposerInputTokenPosition {
	id: string;
	position: number;
}

export interface TokenizedComposerInputHandle {
	focus: () => void;
	getCursorPosition: () => number;
	setCursorPosition: (position: number) => void;
}

interface ReadComposerState {
	text: string;
	tokenPositions: ComposerInputTokenPosition[];
	tokenSignature: string;
}

function getTokenId(element: Element): string | undefined {
	return element instanceof HTMLElement ? element.dataset.composerTokenId : undefined;
}

function readComposerDom(element: HTMLElement): ReadComposerState {
	let text = "";
	const tokenPositions: ComposerInputTokenPosition[] = [];
	const tokenSignatures: string[] = [];

	const walk = (node: Node) => {
		if (node.nodeType === Node.TEXT_NODE) {
			text += node.textContent ?? "";
			return;
		}
		if (!(node instanceof Element)) {
			return;
		}

		const tokenId = getTokenId(node);
		if (tokenId) {
			const tokenText = node.textContent ?? "";
			tokenPositions.push({ id: tokenId, position: text.length });
			text += tokenText;
			tokenSignatures.push(
				[
					tokenId,
					node.getAttribute("data-composer-token-kind") ?? "",
					tokenText,
					text.length - tokenText.length,
				].join(":"),
			);
			return;
		}

		for (const child of Array.from(node.childNodes)) {
			walk(child);
		}
	};

	for (const child of Array.from(element.childNodes)) {
		walk(child);
	}

	return {
		text,
		tokenPositions,
		tokenSignature: tokenSignatures.join("|"),
	};
}

function measureTextLength(node: Node): number {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent?.length ?? 0;
	}
	if (!(node instanceof Element)) {
		return 0;
	}
	const tokenId = getTokenId(node);
	if (tokenId) {
		return node.textContent?.length ?? 0;
	}

	return Array.from(node.childNodes).reduce(
		(length, child) => length + measureTextLength(child),
		0,
	);
}

function getCursorPosition(element: HTMLElement): number {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return readComposerDom(element).text.length;
	}

	const range = selection.getRangeAt(0);
	if (!element.contains(range.startContainer)) {
		return readComposerDom(element).text.length;
	}

	let textLength = 0;
	let found = false;

	const walk = (node: Node) => {
		if (found) {
			return;
		}

		if (node === range.startContainer) {
			if (node.nodeType === Node.TEXT_NODE) {
				textLength += range.startOffset;
			} else {
				for (const child of Array.from(node.childNodes).slice(0, range.startOffset)) {
					textLength += measureTextLength(child);
				}
			}
			found = true;
			return;
		}

		if (node.nodeType === Node.TEXT_NODE) {
			textLength += node.textContent?.length ?? 0;
			return;
		}
		if (!(node instanceof Element)) {
			return;
		}
		if (getTokenId(node)) {
			textLength += measureTextLength(node);
			return;
		}

		for (const child of Array.from(node.childNodes)) {
			walk(child);
			if (found) {
				return;
			}
		}
	};

	walk(element);
	return textLength;
}

function setCursorPosition(element: HTMLElement, position: number) {
	let remaining = Math.max(0, position);

	const place = (node: Node): boolean => {
		if (node.nodeType === Node.TEXT_NODE) {
			const textLength = node.textContent?.length ?? 0;
			if (remaining > textLength) {
				remaining -= textLength;
				return false;
			}
			const range = document.createRange();
			range.setStart(node, remaining);
			range.collapse(true);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			return true;
		}

		if (!(node instanceof Element)) {
			return false;
		}

		const tokenId = getTokenId(node);
		if (tokenId) {
			const tokenLength = node.textContent?.length ?? 0;
			if (remaining > tokenLength) {
				remaining -= tokenLength;
				return false;
			}

			const range = document.createRange();
			if (remaining === 0) {
				range.setStartBefore(node);
			} else {
				range.setStartAfter(node);
			}
			range.collapse(true);
			const selection = window.getSelection();
			selection?.removeAllRanges();
			selection?.addRange(range);
			return true;
		}

		for (const child of Array.from(node.childNodes)) {
			if (place(child)) {
				return true;
			}
		}
		return false;
	};

	if (place(element)) {
		return;
	}

	const range = document.createRange();
	range.selectNodeContents(element);
	range.collapse(false);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
}

function setCursorAfterToken(element: HTMLElement, tokenId: string) {
	const token = Array.from(element.querySelectorAll("[data-composer-token-id]")).find(
		(candidate) =>
			candidate instanceof HTMLElement && candidate.dataset.composerTokenId === tokenId,
	);
	if (!token) {
		return false;
	}

	const range = document.createRange();
	range.setStartAfter(token);
	range.collapse(true);
	const selection = window.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	return true;
}

function normaliseTokens(value: string, tokens: ComposerInputToken[]) {
	return [...tokens]
		.map((token) => ({
			...token,
			position: Math.min(Math.max(token.position, 0), value.length),
		}))
		.sort((first, second) => first.position - second.position);
}

function getTokenClassName(kind: ComposerInputToken["kind"]) {
	switch (kind) {
		case "agent":
			return "border-blue-400/45 bg-blue-500/10 text-blue-100";
		case "skill":
			return "border-fuchsia-400/45 bg-fuchsia-500/10 text-fuchsia-100";
		case "tool":
			return "border-violet-400/45 bg-violet-500/10 text-violet-100";
		case "action":
		default:
			return "border-cyan-400/45 bg-cyan-500/10 text-cyan-100";
	}
}

function createTokenSignature(tokens: ComposerInputToken[]) {
	return tokens
		.map((token) =>
			[token.id, token.kind, getComposerInlineTokenText(token.label), token.position].join(":"),
		)
		.join("|");
}

function renderComposerDom(element: HTMLElement, value: string, tokens: ComposerInputToken[]) {
	element.replaceChildren();
	let cursor = 0;

	for (const token of tokens) {
		const tokenText = getComposerInlineTokenText(token.label);
		const text = value.slice(cursor, token.position);
		if (text) {
			element.appendChild(document.createTextNode(text));
		}

		const tokenElement = document.createElement("span");
		tokenElement.dataset.composerTokenId = token.id;
		tokenElement.dataset.composerTokenKind = token.kind;
		tokenElement.dataset.testid = "composer-token-part";
		tokenElement.contentEditable = "false";
		tokenElement.className = cn(
			"mx-1 inline-flex max-w-56 select-none items-center gap-1.5 rounded-md border px-2 py-0.5 align-baseline text-sm font-medium leading-normal",
			getTokenClassName(token.kind),
		);
		tokenElement.textContent = tokenText;
		element.appendChild(tokenElement);
		cursor = token.position + tokenText.length;
	}

	const remainingText = value.slice(cursor);
	if (remainingText) {
		element.appendChild(document.createTextNode(remainingText));
	}
}

function insertTextAtSelection(text: string) {
	const selection = window.getSelection();
	if (!selection || selection.rangeCount === 0) {
		return;
	}

	selection.deleteFromDocument();
	const range = selection.getRangeAt(0);
	const textNode = document.createTextNode(text);
	range.insertNode(textNode);
	range.setStartAfter(textNode);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

export const TokenizedComposerInput = forwardRef<
	TokenizedComposerInputHandle,
	TokenizedComposerInputProps
>(
	(
		{
			id,
			value,
			tokens = [],
			placeholder,
			ariaLabel,
			ariaDescribedBy,
			disabled = false,
			className,
			onChange,
			onCursorPositionChange,
			onTokenPositionsChange,
			onKeyDown,
		},
		ref,
	) => {
		const editableRef = useRef<HTMLDivElement>(null);
		const orderedTokens = useMemo(() => normaliseTokens(value, tokens), [tokens, value]);
		const expectedTokenSignature = useMemo(
			() => createTokenSignature(orderedTokens),
			[orderedTokens],
		);
		const isEmpty = value.length === 0 && orderedTokens.length === 0;

		useImperativeHandle(
			ref,
			() => ({
				focus: () => editableRef.current?.focus(),
				getCursorPosition: () =>
					editableRef.current ? getCursorPosition(editableRef.current) : value.length,
				setCursorPosition: (position: number) => {
					if (editableRef.current) {
						editableRef.current.focus();
						setCursorPosition(editableRef.current, position);
					}
				},
			}),
			[value.length],
		);

		useLayoutEffect(() => {
			const editable = editableRef.current;
			if (!editable) {
				return;
			}

			const current = readComposerDom(editable);
			if (current.text === value && current.tokenSignature === expectedTokenSignature) {
				return;
			}

			const wasFocused = document.activeElement === editable;
			const cursorPosition = wasFocused ? getCursorPosition(editable) : value.length;
			const existingTokenIds = new Set(current.tokenPositions.map((position) => position.id));
			const tokenToEnterAfter = orderedTokens.find(
				(token) =>
					!existingTokenIds.has(token.id) &&
					cursorPosition >= token.position &&
					cursorPosition <= token.position + getComposerInlineTokenText(token.label).length,
			);
			renderComposerDom(editable, value, orderedTokens);
			if (wasFocused) {
				if (!tokenToEnterAfter || !setCursorAfterToken(editable, tokenToEnterAfter.id)) {
					setCursorPosition(editable, Math.min(cursorPosition, value.length));
				}
				onCursorPositionChange(getCursorPosition(editable));
			}
		}, [expectedTokenSignature, onCursorPositionChange, orderedTokens, value]);

		const emitCurrentState = () => {
			const editable = editableRef.current;
			if (!editable) {
				return;
			}

			const current = readComposerDom(editable);
			onChange(current.text);
			onTokenPositionsChange(current.tokenPositions);
			onCursorPositionChange(getCursorPosition(editable));
		};

		const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
			event.preventDefault();
			insertTextAtSelection(event.clipboardData.getData("text/plain"));
			emitCurrentState();
		};

		return (
			<div
				className={cn(
					"relative min-h-[36px] min-w-0 flex-1 cursor-text",
					disabled && "pointer-events-none opacity-60",
					className,
				)}
				onMouseDown={(event) => {
					if (event.target === event.currentTarget) {
						event.preventDefault();
						editableRef.current?.focus();
						if (editableRef.current) {
							setCursorPosition(editableRef.current, value.length);
						}
					}
				}}
			>
				<div
					id={id}
					ref={editableRef}
					role="textbox"
					aria-label={ariaLabel}
					aria-describedby={ariaDescribedBy}
					aria-disabled={disabled}
					contentEditable={!disabled}
					suppressContentEditableWarning={true}
					className="min-h-[36px] w-full whitespace-pre-wrap break-words bg-transparent text-base leading-9 outline-none dark:text-white"
					onInput={emitCurrentState}
					onKeyDown={onKeyDown}
					onKeyUp={() => {
						if (editableRef.current) {
							onCursorPositionChange(getCursorPosition(editableRef.current));
						}
					}}
					onMouseUp={() => {
						if (editableRef.current) {
							onCursorPositionChange(getCursorPosition(editableRef.current));
						}
					}}
					onPaste={handlePaste}
				/>
				{isEmpty && (
					<span className="pointer-events-none absolute left-0 top-0 leading-9 text-zinc-400 dark:text-zinc-500">
						{placeholder}
					</span>
				)}
			</div>
		);
	},
);

TokenizedComposerInput.displayName = "TokenizedComposerInput";
