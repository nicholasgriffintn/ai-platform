import { ChatHistoryControls } from "@ngriffin_uk/polychat-component-account";
import { apiService } from "@ngriffin_uk/polychat-library-client";
import {
  useTrackEvent,
  useDeleteAllLocalChats,
  useDeleteAllRemoteChats,
} from "@ngriffin_uk/polychat-library-react";
import { downloadBlob } from "@ngriffin_uk/polychat-utility-react";
import { useState } from "react";
import { toast } from "sonner";

import { ProfileTab } from "../ProfileTabLayout.js";

export function ProfileHistoryTab() {
  const { trackEvent } = useTrackEvent();

  const deleteAllChats = useDeleteAllLocalChats();
  const deleteAllRemoteChats = useDeleteAllRemoteChats();
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingPoly, setIsExportingPoly] = useState(false);

  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      trackEvent({
        name: "export_chat_history_json",
        category: "profile",
        label: "export_chat_history_json",
        value: 1,
      });
      const blob = await apiService.exportChatHistory();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");

      downloadBlob(`chat-history-${ts}.json`, blob);
    } catch (error) {
      console.error("Failed to export chat history:", error);
      toast.error("Couldn't export chat history", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPoly = async () => {
    setIsExportingPoly(true);
    try {
      trackEvent({
        name: "export_poly_bundle",
        category: "profile",
        label: "export_poly_bundle",
        value: 1,
      });
      const blob = await apiService.exportPolyBundle();

      downloadBlob(`poly-${new Date().toISOString().slice(0, 10)}.aip`, blob);
    } catch (error) {
      console.error("Failed to export Poly:", error);
      toast.error("Couldn't export Poly", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsExportingPoly(false);
    }
  };

  return (
    <ProfileTab title="Chat History">
      <ChatHistoryControls
        isExporting={isExporting}
        isExportingPoly={isExportingPoly}
        isDeletingLocal={deleteAllChats.isPending}
        isDeletingRemote={deleteAllRemoteChats.isPending}
        onExport={() => void handleExportJson()}
        onExportPoly={() => void handleExportPoly()}
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
