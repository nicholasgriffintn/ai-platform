import { Construction } from "lucide-react";

import { PageHeader } from "~/components/PageHeader";
import { PageTitle } from "~/components/PageTitle";
import { useTrackEvent } from "~/hooks/use-track-event";
import {
  useDeleteAllLocalChats,
  useDeleteAllRemoteChats,
} from "~/hooks/useChat";
import { Alert, AlertDescription, AlertTitle, Button } from "../../ui";

export function ProfileHistoryTab() {
  const trackEvent = useTrackEvent();

  const deleteAllChats = useDeleteAllLocalChats();
  const deleteAllRemoteChats = useDeleteAllRemoteChats();

  const handleDeleteAllLocalChats = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all local conversations? This cannot be undone.",
      )
    ) {
      return;
    }

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
      alert("Failed to delete all conversations. Please try again.");
    }
  };

  const handleDeleteAllRemoteChats = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete all remote conversations? This cannot be undone.",
      )
    ) {
      return;
    }

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
      alert("Failed to delete all conversations. Please try again.");
    }
  };

  return (
    <div>
      <PageHeader>
        <PageTitle title="Chat History" />
      </PageHeader>

      <div>
        <div className="text-zinc-500 dark:text-zinc-400">
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
            Message History
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Export your history as JSON, or import existing data.
          </p>
          <Alert variant="info">
            <Construction className="h-4 w-4 mr-2" />
            <AlertTitle>Coming soon</AlertTitle>
            <AlertDescription>This feature is coming soon.</AlertDescription>
          </Alert>
          <div className="border-b border-zinc-200 dark:border-zinc-800 mb-4" />
          <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-100 mb-4">
            Danger Zone
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Permanently delete your history from your local device:
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteAllLocalChats}
            disabled={deleteAllChats.isPending}
          >
            Delete all local chats
          </Button>
          <div className="border-b border-zinc-200 dark:border-zinc-800 mb-4" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Permanently delete your history from our servers*:
          </p>
          <Button
            variant="destructive"
            onClick={handleDeleteAllRemoteChats}
            disabled={deleteAllRemoteChats.isPending}
          >
            Delete all remote chats
          </Button>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">
            *Please note: The retention policies of our hosting partners may
            vary.
          </p>
        </div>
      </div>
    </div>
  );
}
