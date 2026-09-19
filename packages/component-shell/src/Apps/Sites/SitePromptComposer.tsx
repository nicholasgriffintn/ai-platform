import { Button, cn, Textarea } from "@ngriffin_uk/polychat-component-ui";
import { SITE_PROMPT_MAX_LENGTH } from "@ngriffin_uk/polychat-schemas";
import { ArrowUp, Square } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent, type Ref } from "react";

export interface SitePromptComposerProps {
  placeholder: string;
  submitLabel: string;
  isBusy: boolean;
  onSubmit: (prompt: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
  size?: "compact" | "hero";
  className?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  inputRef?: Ref<HTMLTextAreaElement>;
}

export function SitePromptComposer({
  placeholder,
  submitLabel,
  isBusy,
  onSubmit,
  onCancel,
  autoFocus,
  size = "compact",
  className,
  value,
  onValueChange,
  inputRef,
}: SitePromptComposerProps) {
  const [internalValue, setInternalValue] = useState("");
  const currentValue = value ?? internalValue;
  const trimmed = currentValue.trim();
  const canSubmit = trimmed.length > 0 && !isBusy;
  const updateValue = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  const submit = () => {
    if (!canSubmit) {
      return;
    }

    onSubmit(trimmed);
    updateValue("");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 shadow-sm focus-within:border-ring",
        className,
      )}
    >
      <Textarea
        ref={inputRef}
        value={currentValue}
        onChange={(event) => updateValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={SITE_PROMPT_MAX_LENGTH}
        autoFocus={autoFocus}
        rows={size === "hero" ? 4 : 2}
        aria-label={submitLabel}
        className={cn(
          "resize-none border-0 bg-transparent shadow-none focus-visible:ring-0",
          size === "hero" ? "min-h-28 text-base" : "min-h-14 text-sm",
        )}
      />
      <div className="flex items-center justify-between gap-2 px-1">
        <span className="text-xs text-muted-foreground">
          {size === "hero" ? "Enter to build, shift+enter for a new line" : "Enter to send"}
        </span>
        {isBusy && onCancel ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            icon={<Square size={14} />}
            onClick={onCancel}
          >
            Stop
          </Button>
        ) : (
          <Button
            type="submit"
            variant="primary"
            size={size === "hero" ? "md" : "sm"}
            icon={<ArrowUp size={14} />}
            disabled={!canSubmit}
            isLoading={isBusy}
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  );
}
