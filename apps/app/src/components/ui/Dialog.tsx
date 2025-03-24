import { X } from "lucide-react";
import * as React from "react";

import { cn } from "~/lib/utils";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  width?: string;
}

export function Dialog({
  open,
  onOpenChange,
  children,
  width = "600px",
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;

    if (open) {
      dialogEl.showModal();
      document.body.style.overflow = "hidden";

      if (width) {
        dialogEl.style.width = width;
        dialogEl.style.maxWidth = "95vw";
      }
    } else {
      dialogEl.close();
      document.body.style.overflow = "";
    }

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onOpenChange(false);
    };

    dialogEl.addEventListener("cancel", handleCancel);

    return () => {
      dialogEl.removeEventListener("cancel", handleCancel);
    };
  }, [open, onOpenChange, width]);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        "z-50 m-0 p-0 bg-transparent rounded-lg",
        "backdrop:bg-black/50",
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onOpenChange(false);
        }
      }}
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="w-full p-4">{children}</div>
    </dialog>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({
  children,
  className = "",
}: DialogContentProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700",
        "rounded-lg shadow-lg w-full overflow-hidden relative",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div className="max-h-[85vh] overflow-auto p-6">{children}</div>
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className = "" }: DialogHeaderProps) {
  return (
    <div className={cn("mb-4 flex justify-between items-center", className)}>
      {children}
    </div>
  );
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className = "" }: DialogTitleProps) {
  return (
    <h2
      id="dialog-title"
      className={cn(
        "text-lg font-semibold text-zinc-900 dark:text-zinc-100",
        className,
      )}
    >
      {children}
    </h2>
  );
}

interface DialogCloseProps {
  onClick: () => void;
  className?: string;
}

export function DialogClose({ onClick, className = "" }: DialogCloseProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute top-4 right-4 inline-flex items-center justify-center rounded-full p-2",
        "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
        "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700",
        "transition-colors",
        className,
      )}
      aria-label="Close dialog"
    >
      <X size={18} />
    </button>
  );
}
