import { ChatHistoryControls } from "@ngriffin_uk/polychat-component-account";
import { apiService } from "@ngriffin_uk/polychat-library-client";
import {
  useTrackEvent,
  useDeleteAllLocalChats,
  useDeleteAllRemoteChats,
} from "@ngriffin_uk/polychat-library-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileHistoryTab() {
  const { trackEvent } = useTrackEvent();

  const deleteAllChats = useDeleteAllLocalChats();
  const deleteAllRemoteChats = useDeleteAllRemoteChats();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      trackEvent({
        name: "export_account_data",
        category: "profile",
        label: "export_account_data",
        value: 1,
      });
      const blob = await apiService.exportAccountData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");

      a.href = url;
      a.download = `polychat-export-${ts}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export account data:", error);
      toast.error("Couldn't export your data", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ProfileTab title="Chat History">
      <ChatHistoryControls
        isExporting={isExporting}
        isDeletingLocal={deleteAllChats.isPending}
        isDeletingRemote={deleteAllRemoteChats.isPending}
        onExport={() => void handleExport()}
        onDeleteLocal={async () => {
          try {
            trackEvent({
              name: "delete_all_local_chats",
              category: "profile",
              label: "delete_all_local_chats",
              value: 1,
            });
            await deleteAllChats.mutateAsync();
          } catch (error) {
            console.error("Failed to delete all chats:", error);
          }
        }}
        onDeleteRemote={async () => {
          try {
            trackEvent({
              name: "delete_all_remote_chats",
              category: "profile",
              label: "delete_all_remote_chats",
              value: 1,
            });
            await deleteAllRemoteChats.mutateAsync();
          } catch (error) {
            console.error("Failed to delete all remote chats:", error);
          }
        }}
      />
    </ProfileTab>
  );
}
