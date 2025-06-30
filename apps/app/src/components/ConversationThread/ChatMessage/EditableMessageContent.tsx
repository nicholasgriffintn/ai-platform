import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "~/components/ui/Button";
import { Textarea } from "~/components/ui/Textarea";
import type { Message } from "~/types";

interface EditableMessageContentProps {
  message: Message;
  onSave: (newContent: string) => void;
  onCancel: () => void;
  isUpdating?: boolean;
}

export const EditableMessageContent = ({
  message,
  onSave,
  onCancel,
  isUpdating = false,
}: EditableMessageContentProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(() => {
    if (typeof message.content === "string") {
      return message.content;
    }
    return message.content
      .filter((item) => item.type === "text")
      .map((item) => (item as any).text)
      .join("\n");
  });

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(
        textareaRef.current.value.length,
        textareaRef.current.value.length,
      );
    }
  }, []);

  const handleSave = () => {
    if (
      content.trim() &&
      content.trim() !==
        (typeof message.content === "string"
          ? message.content
          : message.content.map((item) => (item as any).text).join("\n"))
    ) {
      onSave(content.trim());
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={handleTextareaChange}
        onKeyDown={handleKeyDown}
        disabled={isUpdating}
        className="resize-none min-h-[80px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Edit your message..."
      />

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={isUpdating}
          className="flex items-center gap-1"
        >
          <X size={14} />
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isUpdating || !content.trim()}
          isLoading={isUpdating}
          className="flex items-center gap-1"
        >
          <Check size={14} />
          Save
        </Button>
      </div>

      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        Press{" "}
        <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-xs">
          Cmd+Enter
        </kbd>{" "}
        to save,{" "}
        <kbd className="px-1 py-0.5 bg-zinc-100 dark:bg-zinc-700 rounded text-xs">
          Esc
        </kbd>{" "}
        to cancel
      </div>
    </div>
  );
};
