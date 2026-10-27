import { ButtonLink, EmptyState, SegmentedControl } from "@ngriffin_uk/polychat-component-ui";
import {
  inboxEntriesFor,
  WorkInbox,
  workPlaceNamesFrom,
} from "@ngriffin_uk/polychat-component-workspaces";
import { useChatStore } from "@ngriffin_uk/polychat-library-client";
import {
  canManageWorkspace,
  getProjectBasePath,
  useDecideInboxHire,
  useMyTasks,
  useTaskAttention,
  useWorkInbox,
  useWorkspaces,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { BriefcaseBusiness } from "lucide-react";
import { toast } from "sonner";

import { SignInEmptyState } from "../Account/SignInEmptyState.js";
import { PageShell } from "../Shell/PageShell.js";
import { useViewParam } from "../Work/useViewParam.js";
import { readInboxView, type InboxPageView } from "./inbox-view.js";
import { InboxMyTasks } from "./InboxMyTasks.js";

export function AttentionPage({ surface }: { surface: "chat" | "work" }) {
  const isAuthenticated = useChatStore((state) => state.isAuthenticated);
  const isAuthenticationLoading = useChatStore((state) => state.isAuthenticationLoading);
  const isPro = useChatStore((state) => state.isPro);
  const [view, setView] = useViewParam<InboxPageView>(readInboxView, "needs");
  const decisions = useWorkInbox();
  const tasks = useTaskAttention();
  const myTasks = useMyTasks();
  const workspaces = useWorkspaces();
  const names = workPlaceNamesFrom(decisions.data?.places ?? []);
  const decideHire = useDecideInboxHire();
  const managedWorkspaceIds = new Set(
    (workspaces.data ?? [])
      .filter((workspace) => canManageWorkspace(workspace))
      .map((workspace) => workspace.id),
  );
  const decisionItems = decisions.data?.data ?? [];
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
    <PageShell.Content className="max-w-5xl">
      <PageShell.Header title="Inbox" />

      {isAuthenticationLoading ? null : !isAuthenticated ? (
        <SignInEmptyState
          title="Sign in to review your work"
          message="Your inbox only includes workspaces you can currently access."
        />
      ) : !isPro ? (
        <div className="space-y-6">
          <WorkInbox
            view="needs"
            decisions={decisionItems}
            tasks={[]}
            names={names}
            personalFirst={surface === "chat"}
            projectHref={getProjectBasePath}
            isLoading={decisions.isLoading}
            errorMessage={
              decisions.error ? getErrorMessage(decisions.error, "Inbox unavailable") : undefined
            }
            canDecideHire={() => false}
            isBusy={false}
            onDecideHire={() => undefined}
            onRead={() => undefined}
            onDismiss={() => undefined}
          />
          <EmptyState
            variant="inset"
            icon={<BriefcaseBusiness className="text-muted-foreground" size={22} />}
            title="Shared project work lives in Work"
            message="Upgrade to see approvals, hires and escalations from every workspace you belong to here."
            action={
              <ButtonLink href="/work" variant="outline" size="sm">
                See what Work includes
              </ButtonLink>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          <SegmentedControl
            label="Inbox views"
            value={view}
            options={[
              {
                id: "needs",
                label: "Needs you",
                count: inboxEntriesFor("needs", decisionItems, tasks.items).length,
              },
              {
                id: "updates",
                label: "Updates",
                count: inboxEntriesFor("updates", decisionItems, tasks.items).length,
              },
              { id: "mine", label: "My tasks", count: myTasks.data?.tasks.length },
            ]}
            onChange={setView}
          />
          {view === "mine" ? (
            <InboxMyTasks
              tasks={myTasks.data?.tasks ?? []}
              isLoading={myTasks.isLoading}
              names={names}
            />
          ) : (
            <WorkInbox
              view={view}
              decisions={decisionItems}
              tasks={tasks.items}
              names={names}
              personalFirst={surface === "chat"}
              projectHref={getProjectBasePath}
              isLoading={tasks.isLoading || decisions.isLoading}
              errorMessage={loadError ? getErrorMessage(loadError, "Inbox unavailable") : undefined}
              canDecideHire={(workspaceId) => managedWorkspaceIds.has(workspaceId)}
              isBusy={decideHire.isPending}
              onDecideHire={(item, decision) => {
                if (item.teammateId && item.workspaceId) {
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
        </div>
      )}
    </PageShell.Content>
  );
}
