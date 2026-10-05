import { ChannelBindingsPanel } from "@ngriffin_uk/polychat-component-account";
import {
  useAuthStatus,
  useChannelBindings,
  useCreateChannelBinding,
  useDeleteChannelBinding,
  useTeammates,
  useUIStore,
  useUpdateChannelBinding,
} from "@ngriffin_uk/polychat-library-react";

export function ChannelSettings({
  projectId,
  teammates: projectTeammates,
}: {
  projectId?: string;
  teammates?: { id: string; name: string }[];
}) {
  const { isAuthenticated } = useAuthStatus();
  const query = useChannelBindings();
  const create = useCreateChannelBinding();
  const update = useUpdateChannelBinding();
  const remove = useDeleteChannelBinding();
  const { teammates } = useTeammates({ enabled: isAuthenticated && !projectId });
  const showLogin = useUIStore((state) => state.setShowLoginModal);
  const bindings = (query.data?.bindings ?? []).filter((binding) =>
    projectId
      ? binding.scopeType === "project" && binding.scopeId === projectId
      : binding.scopeType === "personal",
  );

  return (
    <ChannelBindingsPanel
      bindings={bindings}
      teammates={
        projectTeammates ??
        teammates.map((teammate) => ({ id: teammate.id, name: teammate.name ?? teammate.id }))
      }
      projectId={projectId}
      isAuthenticated={isAuthenticated}
      isLoading={query.isLoading}
      loadError={query.error?.message}
      createError={create.error?.message}
      isCreating={create.isPending}
      updatingId={update.isPending ? update.variables?.id : undefined}
      deletingId={remove.isPending ? remove.variables : undefined}
      onSignIn={() => showLogin(true)}
      onRetry={() => void query.refetch()}
      onCreate={async (input) => {
        await create.mutateAsync(input);
      }}
      onUpdate={async (id, input) => {
        await update.mutateAsync({ id, input });
      }}
      onDelete={async (id) => {
        await remove.mutateAsync(id);
      }}
    />
  );
}
