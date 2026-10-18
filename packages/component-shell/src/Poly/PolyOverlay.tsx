import { Dialog, DialogContent, DialogDescription } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { PolyPanel } from "./PolyPanel.js";

export function PolyOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} width="min(56rem, 96vw)">
      <DialogContent
        className="flex h-[min(44rem,92dvh)] flex-col gap-0 overflow-hidden p-0 pr-10"
        fullScreen={isExpanded}
      >
        <DialogDescription className="sr-only">
          One conversation that carries on wherever you are in Polychat.
        </DialogDescription>
        <PolyPanel
          layout="window"
          isExpanded={isExpanded}
          onToggleExpanded={() => setIsExpanded((expanded) => !expanded)}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
