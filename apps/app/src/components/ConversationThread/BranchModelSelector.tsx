import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/Dialog";
import { Button } from "~/components/ui/Button";
import { ModelSelector } from "./ChatInput/ModelSelector";
import { useChatStore } from "~/state/stores/chatStore";

interface BranchModelSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onModelSelect: (modelId: string) => void;
}

export const BranchModelSelector = ({
  isOpen,
  onClose,
  onModelSelect,
}: BranchModelSelectorProps) => {
  const { model } = useChatStore();
  const [localSelected, setLocalSelected] = useState<string | null>(null);

  const effectiveSelected = useMemo(
    () => localSelected ?? (typeof model === "string" ? model : null),
    [localSelected, model],
  );

  useEffect(() => {
    if (!isOpen) {
      setLocalSelected(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Select Model for Branch</DialogTitle>
          <DialogDescription>
            Choose a featured model to generate the first response in the new
            branch.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <ModelSelector featuredOnly minimal />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!effectiveSelected}
            onClick={() => {
              if (effectiveSelected) {
                onModelSelect(effectiveSelected);
              }
            }}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
