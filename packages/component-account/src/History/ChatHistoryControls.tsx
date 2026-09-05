import { Button, ConfirmationDialog } from "@ngriffin_uk/polychat-component-ui";
import { useState } from "react";

import { SettingsSection } from "../SettingsSection";

export interface ChatHistoryControlsProps {
  isExporting?: boolean;
  isDeletingLocal?: boolean;
  isDeletingRemote?: boolean;
  onExport: () => void;
  onDeleteLocal: () => void | Promise<void>;
  onDeleteRemote: () => void | Promise<void>;
}

export function ChatHistoryControls({
  isExporting = false,
  isDeletingLocal = false,
  isDeletingRemote = false,
  onExport,
  onDeleteLocal,
  onDeleteRemote,
}: ChatHistoryControlsProps) {
  const [confirming, setConfirming] = useState<"local" | "remote" | null>(null);

  return (
    <div className="space-y-6">
      <SettingsSection title="Message History" description="Export your history as JSON.">
        <div className="space-y-2">
          <Button variant="primary" onClick={onExport} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export JSON"}
          </Button>
          {isExporting && (
            <p className="text-muted-foreground text-sm">
              Exporting please do not close the page...
            </p>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="Danger Zone" description="Deleting your history cannot be undone.">
        <div className="space-y-6">
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Permanently delete your history from your local device:
            </p>
            <Button
              variant="destructive"
              onClick={() => setConfirming("local")}
              disabled={isDeletingLocal || isExporting}
            >
              Delete all local chats
            </Button>
          </div>

          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">
              Permanently delete your history from our servers*:
            </p>
            <Button
              variant="destructive"
              onClick={() => setConfirming("remote")}
              disabled={isDeletingRemote || isExporting}
            >
              Delete all remote chats
            </Button>
          </div>

          <p className="text-muted-foreground text-sm">
            *Please note: The retention policies of our hosting partners may vary.
          </p>
        </div>
      </SettingsSection>

      <ConfirmationDialog
        open={confirming === "local"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Delete All Local Conversations"
        description="Are you sure you want to delete all local conversations? This action cannot be undone."
        confirmText="Delete All Local"
        variant="destructive"
        onConfirm={async () => {
          await onDeleteLocal();
          setConfirming(null);
        }}
        isLoading={isDeletingLocal}
      />

      <ConfirmationDialog
        open={confirming === "remote"}
        onOpenChange={(open) => !open && setConfirming(null)}
        title="Delete All Remote Conversations"
        description="Are you sure you want to delete all remote conversations? This action cannot be undone. Note: The retention policies of our hosting partners may vary."
        confirmText="Delete All Remote"
        variant="destructive"
        onConfirm={async () => {
          await onDeleteRemote();
          setConfirming(null);
        }}
        isLoading={isDeletingRemote}
      />
    </div>
  );
}
