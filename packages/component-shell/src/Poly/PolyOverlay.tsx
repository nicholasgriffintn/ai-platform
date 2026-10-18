import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { LazyPolyPanel } from "./LazyPolyPanel.js";
import { PolyOpening } from "./PolyOpening.js";

export function PolyOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} width="min(56rem, 96vw)">
      <DialogContent
        className="flex h-[min(44rem,92dvh)] flex-col gap-0 overflow-hidden p-0"
        fullScreen={isExpanded}
      >
        <DialogDescription className="sr-only">
          One conversation that carries on wherever you are in Polychat.
        </DialogDescription>
        <LazyPolyPanel
          layout="window"
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((expanded) => !expanded)}
          onClose={onClose}
          fallback={
            <>
              <DialogTitle className="sr-only">Poly</DialogTitle>
              <PolyOpening />
            </>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
