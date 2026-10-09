import { SettingsSection } from "@ngriffin_uk/polychat-component-account";
import { Button } from "@ngriffin_uk/polychat-component-ui";
import {
  useAuthStatus,
  useChannelBindings,
  useCapabilityCatalog,
  useTeammates,
} from "@ngriffin_uk/polychat-library-react";
import { MessageSquare, Plus } from "lucide-react";
import { useState } from "react";

import { ChannelBindingCard } from "./ChannelBindingCard.js";
import { ChannelConnectionForm } from "./ChannelConnectionForm.js";

export function ChannelConnections({
  projectId,
  canManage = true,
}: {
  projectId?: string;
  canManage?: boolean;
}) {
  const { bindings, create, disconnect, visibleBindings } = useChannelBindings(projectId);
  const { user } = useAuthStatus();
  const [isConnecting, setIsConnecting] = useState(false);
  const { teammates } = useTeammates({ enabled: canManage && !projectId });
  const capabilityCatalog = useCapabilityCatalog(projectId, {
    enabled: canManage && Boolean(projectId),
  });
  const available = projectId
    ? (capabilityCatalog.data?.teammates ?? [])
    : teammates.filter(
        (teammate) =>
          teammate.owner_scope_type === "user" && teammate.owner_scope_id === String(user?.id),
      );
  const description = projectId
    ? "Continue project conversations in Slack."
    : "Continue your conversations in Slack or Telegram direct messages, or by email.";
  const connectAction = canManage ? (
    <Button
      size="sm"
      variant="outline"
      icon={<Plus size={14} />}
      onClick={() => {
        create.reset();
        setIsConnecting(true);
      }}
    >
      Connect channel
    </Button>
  ) : null;
  const content = (
    <div className="space-y-4">
      {bindings.isLoading && (
        <p role="status" className="text-sm text-muted-foreground">
          Loading channels…
        </p>
      )}
      {(bindings.error || disconnect.error) && (
        <p role="alert" className="text-sm text-failure">
          {bindings.error?.message ?? disconnect.error?.message}
        </p>
      )}
      {!bindings.isLoading && !bindings.error && visibleBindings.length === 0 && (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium">No channels connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage
              ? "Connect a channel, then link your account to start a conversation."
              : "A workspace owner or admin can connect a Slack channel for this project."}
          </p>
        </div>
      )}
      {visibleBindings.map((binding) => (
        <ChannelBindingCard
          key={`${user?.id}:${binding.id}`}
          binding={binding}
          onDisconnect={() => disconnect.mutateAsync(binding.id)}
          isDisconnecting={disconnect.isPending}
        />
      ))}
    </div>
  );

  return (
    <>
      {projectId ? (
        <section className="space-y-4 border-t border-border p-5" aria-label="Channels">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-lg bg-active-work/12 p-2 text-active-work">
                <MessageSquare size={17} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Channels</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
            {connectAction}
          </div>
          {content}
        </section>
      ) : (
        <SettingsSection title="Connected channels" description={description}>
          <div className="space-y-4">
            {content}
            {connectAction}
          </div>
        </SettingsSection>
      )}
      {canManage && isConnecting && (
        <ChannelConnectionForm
          projectId={projectId}
          teammates={available}
          onCreate={create.mutateAsync}
          onClose={() => setIsConnecting(false)}
          isPending={create.isPending}
          error={create.error}
        />
      )}
    </>
  );
}
