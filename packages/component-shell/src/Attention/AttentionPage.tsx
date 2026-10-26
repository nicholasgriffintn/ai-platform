import { ButtonLink, EmptyState } from "@ngriffin_uk/polychat-component-ui";
import { WorkInbox } from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  useDecideInboxHire,
  useTaskAttention,
  useWorkInbox,
  useWorkspaces,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";

export function AttentionPage() {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const decisions = useWorkInbox();
  const tasks = useTaskAttention();
  const workspaces = useWorkspaces();
  const decideHire = useDecideInboxHire();
  const managedWorkspaceIds = new Set(
    (workspaces.data ?? [])
      .filter((workspace) => workspace.role === "owner" || workspace.role === "admin")
      .map((workspace) => workspace.id),
  );
  const loadError = tasks.error ?? decisions.error;
  const updateReceipt = async (id: string, action: "read" | "dismiss") => {
    try {
      if (action === "read") {
        await tasks.markRead([id]);
      } else {
        await tasks.dismiss([id]);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Unable to update this notification. Please try again."));
    }
  };

  return (
    <PageShell.Content className="max-w-4xl">
      <PageShell.Header title="Inbox" />

      {isAuthenticationLoading ? null : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to review your work"
          message="Your inbox only includes workspaces you can currently access."
        />
      ) : !isPro ? (
        <EmptyState
          icon={<BriefcaseBusiness className="text-muted-foreground" size={22} />}
          title="Shared project work lives in Work"
          message="Upgrade to see approvals, hires and escalations from every workspace you belong to here."
          action={
            <ButtonLink href="/work" variant="outline" size="sm">
              See what Work includes
            </ButtonLink>
          }
          className="min-h-[200px]"
        />
      ) : (
        <WorkInbox
          decisions={decisions.data?.data ?? []}
          tasks={tasks.items}
          isLoading={tasks.isLoading || decisions.isLoading}
          errorMessage={loadError ? getErrorMessage(loadError, "Inbox unavailable") : undefined}
          canDecideHire={(workspaceId) => managedWorkspaceIds.has(workspaceId)}
          isBusy={decideHire.isPending}
          onDecideHire={(item, decision) => {
            if (item.teammateId) {
              void decideHire.mutateAsync({
                workspaceId: item.workspaceId,
                teammateId: item.teammateId,
                decision,
              });
            }
          }}
          onRead={(item) => void updateReceipt(item.id, "read")}
          onDismiss={(item) => void updateReceipt(item.id, "dismiss")}
        />
      )}
    </PageShell.Content>
  );
}
