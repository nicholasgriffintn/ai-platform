import { cn } from "@ngriffin_uk/polychat-component-ui";
import { Upload } from "lucide-react";
import { type DragEvent, type ReactNode, useRef, useState } from "react";

function carriesFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes("Files");
}

export function FileDropZone({
  label,
  onFiles,
  children,
}: {
  label: string;
  onFiles: (files: File[]) => void;
  children: ReactNode;
}) {
  const depth = useRef(0);
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className="relative"
      onDragEnter={(event) => {
        if (!carriesFiles(event)) {
          return;
        }

        event.preventDefault();
        depth.current += 1;
        setIsOver(true);
      }}
      onDragOver={(event) => {
        if (carriesFiles(event)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event)) {
          return;
        }

        depth.current = Math.max(0, depth.current - 1);
        setIsOver(depth.current > 0);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) {
          return;
        }

        event.preventDefault();
        depth.current = 0;
        setIsOver(false);
        onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {children}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-3 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-active-work bg-canvas/85 opacity-0 backdrop-blur-sm transition-opacity",
          isOver && "opacity-100",
        )}
      >
        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Upload size={18} />
          {label}
        </span>
      </div>
    </div>
  );
}
