import { cn } from "@ngriffin_uk/polychat-component-ui";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import {
  readComposerDom,
  getCursorPosition,
  setCursorPosition,
  setCursorAfterToken,
  scrollCaretIntoView,
  normaliseTokens,
  createTokenSignature,
  getComposerTokenText,
  renderComposerDom,
  insertTextAtSelection,
  type ComposerInputToken,
  type ComposerInputTokenPosition,
} from "../utils/composer-input-dom";
export type { ComposerInputToken, ComposerInputTokenPosition } from "../utils/composer-input-dom";

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

export interface TokenizedComposerInputHandle {
  focus: () => void;
  getCursorPosition: () => number;
  setCursorPosition: (position: number) => void;
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
          cursorPosition <= token.position + getComposerTokenText(token).length,
      );

      renderComposerDom(editable, value, orderedTokens);
      if (wasFocused) {
        if (!tokenToEnterAfter || !setCursorAfterToken(editable, tokenToEnterAfter.id)) {
          setCursorPosition(editable, Math.min(cursorPosition, value.length));
        }

        onCursorPositionChange(getCursorPosition(editable));
        scrollCaretIntoView(editable);
      }
    }, [expectedTokenSignature, onCursorPositionChange, orderedTokens, value]);

    const emitCurrentState = (isComposing = false) => {
      const editable = editableRef.current;

      if (!editable) {
        return;
      }

      const cursorPosition = getCursorPosition(editable);

      if (!isComposing) {
        editable.normalize();
        setCursorPosition(editable, cursorPosition);
      }

      const current = readComposerDom(editable);

      onChange(current.text);
      onTokenPositionsChange(current.tokenPositions);
      onCursorPositionChange(cursorPosition);
    };

    const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      insertTextAtSelection(event.clipboardData.getData("text/plain"));
      emitCurrentState();

      if (editableRef.current) {
        scrollCaretIntoView(editableRef.current);
      }
    };

    return (
      <div
        role="presentation"
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
          tabIndex={disabled ? -1 : 0}
          data-dynamic-copy=""
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
          aria-disabled={disabled}
          contentEditable={!disabled}
          suppressContentEditableWarning
          className="max-h-[min(18rem,40dvh)] min-h-[36px] w-full overflow-y-auto bg-transparent text-base leading-6 break-words whitespace-pre-wrap outline-none"
          onInput={(event) =>
            emitCurrentState(
              event.nativeEvent instanceof InputEvent && event.nativeEvent.isComposing,
            )
          }
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
          <span
            className="pointer-events-none absolute top-0 left-0 leading-6 text-muted-foreground"
            data-dynamic-copy=""
          >
            {placeholder}
          </span>
        )}
      </div>
    );
  },
);

TokenizedComposerInput.displayName = "TokenizedComposerInput";
