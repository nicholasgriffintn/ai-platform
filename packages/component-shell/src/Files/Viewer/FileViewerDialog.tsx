import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import type { ReactNode } from "react";

export function FileViewerDialog({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        fullScreen
        className="flex flex-col gap-0 overflow-hidden border-0 bg-canvas p-0 shadow-none outline-none focus:outline-none focus-visible:outline-none [&>button:last-child]:hidden"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">File</DialogTitle>
        <DialogDescription className="sr-only">
          The file, its details and conversations about it.
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
