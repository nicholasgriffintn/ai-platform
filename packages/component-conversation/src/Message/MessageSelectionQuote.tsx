import { Button } from "@ngriffin_uk/polychat-component-ui";
import type { Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { ChatMessageSelection } from "@ngriffin_uk/polychat-schemas";
import { Quote } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

interface MessageSelectionQuoteProps {
  children: ReactNode;
  message: Message;
  onQuote: (selection: ChatMessageSelection) => void;
}

interface ActiveSelection {
  left: number;
  selectedText: string;
  top: number;
}

function normaliseSelectedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function MessageSelectionQuote({ children, message, onQuote }: MessageSelectionQuoteProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeSelection, setActiveSelection] = useState<ActiveSelection | null>(null);

  const handleMouseUp = useCallback(() => {
    if (message.role !== "assistant") {
      return;
    }

    const browserSelection = window.getSelection();
    const root = rootRef.current;
    const range = browserSelection?.rangeCount ? browserSelection.getRangeAt(0) : undefined;

    if (
      !browserSelection ||
      browserSelection.isCollapsed ||
      !range ||
      !root ||
      !root.contains(browserSelection.anchorNode) ||
      !root.contains(browserSelection.focusNode)
    ) {
      setActiveSelection(null);

      return;
    }

    const selectedText = normaliseSelectedText(browserSelection.toString());

    if (!selectedText) {
      setActiveSelection(null);

      return;
    }

    const rangeRect = range.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();

    setActiveSelection({
      selectedText,
      left: Math.max(8, Math.min(rangeRect.left - rootRect.left, rootRect.width - 88)),
      top: rangeRect.bottom - rootRect.top + 8,
    });
  }, [message.role]);

  const handleQuote = useCallback(() => {
    if (!activeSelection) {
      return;
    }

    onQuote({
      source: {
        kind: "message",
        messageId: message.id,
        role: "assistant",
        ...(message.run_id ? { runId: message.run_id } : {}),
      },
      selectedText: activeSelection.selectedText,
    });
    window.getSelection()?.removeAllRanges();
    setActiveSelection(null);
  }, [activeSelection, message.id, message.role, message.run_id, onQuote]);

  useEffect(() => {
    if (!activeSelection) {
      return;
    }

    const handleSelectionChange = () => {
      const browserSelection = window.getSelection();
      const root = rootRef.current;

      if (
        !browserSelection ||
        browserSelection.isCollapsed ||
        !root ||
        !root.contains(browserSelection.anchorNode) ||
        !root.contains(browserSelection.focusNode)
      ) {
        setActiveSelection(null);
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);

    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [activeSelection]);

  return (
    <div ref={rootRef} className="relative" onMouseUp={handleMouseUp}>
      {children}
      {activeSelection ? (
        <div
          className="absolute z-20"
          style={{ left: activeSelection.left, top: activeSelection.top }}
        >
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 border border-border bg-surface-elevated px-2 text-xs shadow-md"
            onMouseDown={(event) => event.preventDefault()}
            onClick={handleQuote}
            aria-label="Quote selection"
          >
            <Quote className="h-3.5 w-3.5" aria-hidden="true" />
            Quote
          </Button>
        </div>
      ) : null}
    </div>
  );
}
