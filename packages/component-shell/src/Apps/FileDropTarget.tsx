import { cn } from "@ngriffin_uk/polychat-component-ui";
import { type DragEvent, type ReactNode, useRef, useState } from "react";

const ACCENT_CLASSES = {
  amber: {
    dragging: "border-accent-amber bg-accent-amber/8",
    idle: "border-border hover:border-accent-amber/60",
  },
  sky: {
    dragging: "border-accent-sky bg-accent-sky/8",
    idle: "border-border hover:border-accent-sky/60",
  },
} as const;

export function FileDropTarget({
  onFiles,
  label,
  accept = "image/*",
  accent = "amber",
  className,
  children,
}: {
  onFiles: (files: File[]) => void;
  label: string;
  accept?: string;
  accent?: keyof typeof ACCENT_CLASSES;
  className?: string;
  children: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const drop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        className={cn(
          "w-full rounded-2xl border-2 border-dashed transition-colors duration-200",
          dragging ? ACCENT_CLASSES[accent].dragging : ACCENT_CLASSES[accent].idle,
          className,
        )}
      >
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
    </>
  );
}
