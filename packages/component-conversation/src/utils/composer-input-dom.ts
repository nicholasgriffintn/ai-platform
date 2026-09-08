import { cn } from "@ngriffin_uk/polychat-component-ui";
import { getComposerInlineTokenText } from "@ngriffin_uk/polychat-library-chat/composer-commands";

export interface ComposerInputToken {
  id: string;
  kind: "action" | "teammate" | "skill" | "tool";
  label: string;
  position: number;
  text?: string;
}

export interface ComposerInputTokenPosition {
  id: string;
  position: number;
}

interface ReadComposerState {
  text: string;
  tokenPositions: ComposerInputTokenPosition[];
  tokenSignature: string;
}

function getTokenId(element: Element): string | undefined {
  return element instanceof HTMLElement ? element.dataset.composerTokenId : undefined;
}

function startsLine(node: Node): boolean {
  return node instanceof Element && /^(DIV|P)$/.test(node.tagName) && node.previousSibling !== null;
}

function isLineBreak(node: Node): boolean {
  return node instanceof Element && node.tagName === "BR";
}

function isEmptyLinePlaceholder(node: Node): boolean {
  return isLineBreak(node) && node.parentNode?.childNodes.length === 1;
}

export function readComposerDom(element: HTMLElement): ReadComposerState {
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

    if (startsLine(node)) {
      text += "\n";
    }

    if (isLineBreak(node)) {
      if (!isEmptyLinePlaceholder(node)) {
        text += "\n";
      }

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

  if (isLineBreak(node)) {
    return isEmptyLinePlaceholder(node) ? 0 : 1;
  }

  return Array.from(node.childNodes).reduce(
    (length, child) => length + measureTextLength(child),
    startsLine(node) ? 1 : 0,
  );
}

export function getCursorPosition(element: HTMLElement): number {
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

    if (node !== element && startsLine(node)) {
      textLength += 1;
    }

    if (isLineBreak(node)) {
      if (!isEmptyLinePlaceholder(node)) {
        textLength += 1;
      }

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

export function setCursorPosition(element: HTMLElement, position: number) {
  let remaining = Math.max(0, position);

  const place = (node: Node): boolean => {
    if (isEmptyLinePlaceholder(node)) {
      return false;
    }

    if ((node !== element && startsLine(node)) || isLineBreak(node)) {
      if (remaining === 0 || (isLineBreak(node) && remaining === 1)) {
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

      remaining -= 1;
      if (isLineBreak(node)) {
        return false;
      }
    }

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

export function setCursorAfterToken(element: HTMLElement, tokenId: string) {
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

export function scrollCaretIntoView(element: HTMLElement) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || !element.contains(selection.anchorNode)) {
    return;
  }

  const caret = selection.getRangeAt(0).getBoundingClientRect();
  const view = element.getBoundingClientRect();

  if (caret.height === 0 && caret.top === 0) {
    element.scrollTop = element.scrollHeight;

    return;
  }

  if (caret.bottom > view.bottom) {
    element.scrollTop += caret.bottom - view.bottom;
  } else if (caret.top < view.top) {
    element.scrollTop -= view.top - caret.top;
  }
}

export function normaliseTokens(value: string, tokens: ComposerInputToken[]) {
  return [...tokens]
    .map((token) => ({
      ...token,
      position: Math.min(Math.max(token.position, 0), value.length),
    }))
    .sort((first, second) => first.position - second.position);
}

function getTokenClassName(kind: ComposerInputToken["kind"]) {
  switch (kind) {
    case "teammate":
      return "border-active-work/45 bg-active-work/10 text-active-work";
    case "skill":
      return "border-creative/45 bg-creative/10 text-creative";
    case "tool":
      return "border-creative/45 bg-creative/10 text-creative";
    case "action":
    default:
      return "border-active-work/45 bg-active-work/10 text-active-work";
  }
}

export function createTokenSignature(tokens: ComposerInputToken[]) {
  return tokens
    .map((token) => [token.id, token.kind, getComposerTokenText(token), token.position].join(":"))
    .join("|");
}

export function getComposerTokenText(token: ComposerInputToken) {
  return token.text ?? getComposerInlineTokenText(token.label);
}

export function renderComposerDom(
  element: HTMLElement,
  value: string,
  tokens: ComposerInputToken[],
) {
  element.replaceChildren();
  let cursor = 0;

  for (const token of tokens) {
    const tokenText = getComposerTokenText(token);
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
      "mx-1 inline-flex max-w-56 items-center gap-1.5 rounded-md border px-2 py-0.5 align-baseline text-sm leading-normal font-medium select-none",
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

export function insertTextAtSelection(text: string) {
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
