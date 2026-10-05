import {
  useAuthStatus,
  useChannelBindings,
  useCapabilityCatalog,
  useTeammates,
} from "@ngriffin_uk/polychat-library-react";

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

  return (
    <section className="space-y-4 p-4 sm:p-6" aria-label="Channels">
      <div>
        <h2 className="text-lg font-semibold">Channels</h2>
        <p className="text-sm text-muted-foreground">
          Continue work from Slack or Telegram with your own permissions. Conversations stay
          separate for each sender and thread.
        </p>
      </div>
      {bindings.isLoading && <p className="text-sm">Loading channels…</p>}
      {(bindings.error || disconnect.error) && (
        <p role="alert" className="text-sm text-failure">
          {bindings.error?.message ?? disconnect.error?.message}
        </p>
      )}
      {visibleBindings.map((binding) => (
        <ChannelBindingCard
          key={`${user?.id}:${binding.id}`}
          binding={binding}
          onDisconnect={() => disconnect.mutateAsync(binding.id)}
          isDisconnecting={disconnect.isPending}
        />
      ))}
      {canManage && (
        <ChannelConnectionForm
          projectId={projectId}
          teammates={available}
          onCreate={create.mutateAsync}
          isPending={create.isPending}
          error={create.error}
        />
      )}
    </section>
  );
}
