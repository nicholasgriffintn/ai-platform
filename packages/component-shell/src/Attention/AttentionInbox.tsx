import { SettingsSection } from "@ngriffin_uk/polychat-component-account";
import { TaskAttentionList } from "@ngriffin_uk/polychat-component-workspaces";
import { useTaskAttention } from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { toast } from "sonner";

export function AttentionInbox() {
  const inbox = useTaskAttention();

  const updateReceipt = async (id: string, action: "read" | "dismiss") => {
    try {
      if (action === "read") {
        await inbox.markRead([id]);
      } else {
        await inbox.dismiss([id]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update this notification. Please try again."));
    }
  };

  return (
    <SettingsSection
      title={`Your inbox${inbox.unread > 0 ? ` · ${inbox.unread} unread` : ""}`}
      description="Task notifications addressed to you. Opening one marks it read everywhere you are signed in."
    >
      {inbox.error ? (
        <p role="alert" className="text-sm text-failure">
          {getErrorMessage(inbox.error, "Inbox could not be loaded")}
        </p>
      ) : null}
      {inbox.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading inbox…</p>
      ) : !inbox.error || inbox.items.length > 0 ? (
        <TaskAttentionList
          items={inbox.items}
          itemHref={(item) => item.deepLink}
          emptyMessage="Nothing is waiting for you."
          onRead={(item) => void updateReceipt(item.id, "read")}
          onDismiss={(item) => void updateReceipt(item.id, "dismiss")}
        />
      ) : null}
    </SettingsSection>
  );
}
