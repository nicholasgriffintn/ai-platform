import { ComposerShell } from "@ngriffin_uk/polychat-component-conversation";
import { Button, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { Send } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";

export function WorkTaskComposer({
  placeholder,
  isSubmitting,
  onSubmit,
}: {
  placeholder: string;
  isSubmitting: boolean;
  onSubmit: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const trimmed = text.trim();
  const canSubmit = trimmed.length > 0 && !isSubmitting;

  const submit = async () => {
    if (canSubmit && (await onSubmit(trimmed))) {
      setText("");
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    void submit();
  };

  return (
    <form onSubmit={handleSubmit}>
      <ComposerShell
        density="compact"
        inputHelp="Press Enter to add the task. Use Shift+Enter for a new line."
        input={
          <Textarea
            rows={1}
            value={text}
            placeholder={placeholder}
            aria-label="New task"
            aria-describedby="message-input-help"
            className="field-sizing-content max-h-40 min-h-6 resize-none rounded-none border-0 bg-transparent p-0 text-sm leading-6 shadow-none focus:ring-0 focus-visible:ring-0"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        }
        actions={
          <Button
            type="submit"
            disabled={!canSubmit}
            isLoading={isSubmitting}
            className="cursor-pointer rounded-md bg-human-action p-2 text-human-action-foreground shadow-sm transition-colors hover:bg-human-action/90 disabled:cursor-not-allowed disabled:opacity-50"
            title="Add task"
            aria-label="Add task"
          >
            <Send className="h-4 w-4" />
          </Button>
        }
      />
    </form>
  );
}
