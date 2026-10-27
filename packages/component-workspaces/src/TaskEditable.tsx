import { cn } from "@ngriffin_uk/polychat-component-ui";
import { useState, type KeyboardEvent } from "react";

function EditableText({
  value,
  placeholder,
  ariaLabel,
  canEdit,
  multiline,
  className,
  onSave,
}: {
  value: string;
  placeholder: string;
  ariaLabel: string;
  canEdit: boolean;
  multiline: boolean;
  className: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() !== value.trim()) {
      onSave(draft.trim());
    }

    setDraft(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(null);
    } else if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  if (draft !== null) {
    return (
      <textarea
        aria-label={ariaLabel}
        autoFocus
        value={draft}
        rows={1}
        className={cn(
          "field-sizing-content w-full resize-none rounded-md border-0 bg-transparent p-0 outline-none focus:ring-0",
          className,
        )}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (!canEdit) {
    return value ? <p className={cn("whitespace-pre-wrap", className)}>{value}</p> : null;
  }

  return (
    <button
      type="button"
      aria-label={`Edit ${ariaLabel.toLowerCase()}`}
      className={cn(
        "block w-full cursor-text rounded-md text-left whitespace-pre-wrap transition-colors hover:bg-selection/40",
        !value && "text-muted-foreground",
        className,
      )}
      onClick={() => setDraft(value)}
    >
      {value || placeholder}
    </button>
  );
}

export function TaskTitle({
  value,
  canEdit,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <EditableText
      value={value}
      placeholder="Untitled task"
      ariaLabel="Title"
      canEdit={canEdit}
      multiline={false}
      className="text-[1.6rem] leading-tight font-semibold tracking-tight text-balance text-foreground"
      onSave={(next) => next && onSave(next)}
    />
  );
}

export function TaskDescription({
  value,
  canEdit,
  onSave,
}: {
  value: string;
  canEdit: boolean;
  onSave: (value: string) => void;
}) {
  return (
    <EditableText
      value={value}
      placeholder="Add a description…"
      ariaLabel="Description"
      canEdit={canEdit}
      multiline
      className="min-h-6 text-[0.95rem] leading-7 text-foreground/90"
      onSave={onSave}
    />
  );
}
