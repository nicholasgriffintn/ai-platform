import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ngriffin_uk/polychat-component-ui";
import { APP_NAME, useAgeGatePromptStore } from "@ngriffin_uk/polychat-library-client";
import { useAgeGate } from "@ngriffin_uk/polychat-library-react";
import { AGE_GATE_MINIMUM_AGE } from "@ngriffin_uk/polychat-schemas";
import { useState } from "react";

import { AgeGateDateForm } from "./AgeGateDateForm.js";

type AgeGateView = "form" | "skipped";

export function AgeGateDialog() {
  const isOpen = useAgeGatePromptStore((state) => state.isOpen);
  const finish = useAgeGatePromptStore((state) => state.finish);
  const { status, confirm, isConfirming, confirmError, resetConfirmError } = useAgeGate();
  const [view, setView] = useState<AgeGateView>("form");
  const isRefused = status === "under_age";

  const close = (allowed: boolean) => {
    setView("form");
    resetConfirmError();
    finish(allowed);
  };

  const handleConfirm = async (birthDate: string) => {
    const response = await confirm(birthDate).catch(() => null);

    if (response?.status === "adult" || response?.status === "not_required") {
      close(true);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      return;
    }

    if (view === "form" && !isRefused) {
      setView("skipped");

      return;
    }

    close(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {isRefused ? (
          <>
            <DialogHeader>
              <DialogTitle>Not this time</DialogTitle>
              <DialogDescription>
                {APP_NAME} is only for people aged {AGE_GATE_MINIMUM_AGE} or over, so sending
                messages stays switched off for this account.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="primary" onClick={() => close(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : view === "skipped" ? (
          <>
            <DialogHeader>
              <DialogTitle>Skip for now?</DialogTitle>
              <DialogDescription>
                Without a date of birth you can&rsquo;t send messages. You can still look around,
                and we&rsquo;ll ask again the next time you try to send one.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>
                Skip
              </Button>
              <Button type="button" variant="primary" onClick={() => setView("form")}>
                Add date of birth
              </Button>
            </DialogFooter>
          </>
        ) : (
          <AgeGateDateForm
            onConfirm={(birthDate) => void handleConfirm(birthDate)}
            onSkip={() => setView("skipped")}
            isConfirming={isConfirming}
            error={confirmError}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
