import { ProjectCodingEnvironmentCard as ControlledProjectCodingEnvironmentCard } from "@ngriffin_uk/polychat-component-workspaces";
import type { ProjectDetail } from "@ngriffin_uk/polychat-schemas";

import { useSandboxConnections, useSandboxRepositoryOptions } from "~/hooks/useSandbox";
import { useProjectEnvironmentCacheAction, useUpdateProject } from "~/hooks/useWorkspaces";

export function ProjectCodingEnvironmentCard({
  canManage,
  project,
  embedded = false,
}: {
  canManage: boolean;
  project: ProjectDetail;
  embedded?: boolean;
}) {
  const updateProject = useUpdateProject();
  const cacheAction = useProjectEnvironmentCacheAction();
  const { data: connections = [], isLoading: isLoadingConnections } = useSandboxConnections();
  const { repoOptions, isLoading: isLoadingRepositories } =
    useSandboxRepositoryOptions(connections);

  return (
    <ControlledProjectCodingEnvironmentCard
      canManage={canManage}
      embedded={embedded}
      codingEnvironment={project.codingEnvironment ?? null}
      environmentCache={project.environmentCache}
      repositoryOptions={repoOptions}
      isLoadingRepositories={isLoadingConnections || isLoadingRepositories}
      isSaving={updateProject.isPending}
      errorMessage={updateProject.error?.message}
      cacheMessage={
        cacheAction.data?.warning ??
        cacheAction.error?.message ??
        (cacheAction.isSuccess
          ? cacheAction.variables.input.action === "rebuild"
            ? "Rebuild requested for the next run."
            : "Environment cache deleted."
          : undefined)
      }
      isUpdatingCache={cacheAction.isPending}
      onConnect={async ({ installationId, repository, deliveryPolicy, environmentSetup }) => {
        await updateProject.mutateAsync({
          projectId: project.id,
          input: {
            codingEnvironment: {
              installationId,
              repository,
              promptStrategy: project.codingEnvironment?.promptStrategy ?? "auto",
              deliveryPolicy,
              environmentSetup,
              timeoutSeconds: project.codingEnvironment?.timeoutSeconds ?? 900,
            },
          },
        });
      }}
      onDisconnect={async () => {
        await updateProject.mutateAsync({
          projectId: project.id,
          input: { codingEnvironment: null },
        });
      }}
      onRebuildCache={async () => {
        await cacheAction.mutateAsync({
          projectId: project.id,
          input: { action: "rebuild" },
        });
      }}
      onDeleteCache={async () => {
        await cacheAction.mutateAsync({
          projectId: project.id,
          input: { action: "delete" },
        });
      }}
    />
  );
}
