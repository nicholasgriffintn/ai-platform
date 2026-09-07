import { ProjectRoutingCard as ControlledProjectRoutingCard } from "@ngriffin_uk/polychat-component-workspaces";
import { useUpdateProject } from "@ngriffin_uk/polychat-library-react";
import type { ProjectDetail } from "@ngriffin_uk/polychat-schemas";

export function ProjectRoutingCard({
  project,
  canManage,
}: {
  project: ProjectDetail;
  canManage: boolean;
}) {
  const updateProject = useUpdateProject();

  return (
    <ControlledProjectRoutingCard
      canManage={canManage}
      defaultModelTier={project.defaultModelTier ?? null}
      isSaving={updateProject.isPending}
      errorMessage={updateProject.error?.message}
      onSave={async (defaultModelTier) => {
        await updateProject.mutateAsync({ projectId: project.id, input: { defaultModelTier } });
      }}
    />
  );
}
