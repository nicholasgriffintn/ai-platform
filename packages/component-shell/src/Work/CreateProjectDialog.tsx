import { CreateProjectDialog as ControlledCreateProjectDialog } from "@ngriffin_uk/polychat-component-workspaces";
import {
  canManageWorkspace,
  useCreateProject,
  useProjectStarters,
  useTemplateMutations,
  useWorkspace,
  useWorkspaceTemplates,
} from "@ngriffin_uk/polychat-library-react";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-core";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export function CreateProjectDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createProject = useCreateProject();
  const workspace = useWorkspace(workspaceId);
  const canManage = Boolean(workspace.data && canManageWorkspace(workspace.data));
  const starters = useProjectStarters(open && canManage);
  const templates = useWorkspaceTemplates(workspaceId, open && canManage);
  const mutations = useTemplateMutations(workspaceId);
  const openProject = (projectId: string) => {
    onOpenChange(false);
    void navigate(`/work/${workspaceId}/projects/${projectId}`);
  };

  return (
    <ControlledCreateProjectDialog
      open={open}
      starters={starters.data ?? []}
      templates={(templates.data ?? []).filter((template) => template.kind === "project")}
      isSubmitting={
        createProject.isPending ||
        mutations.startFromStarter.isPending ||
        mutations.instantiate.isPending
      }
      errorMessage={
        (createProject.error ?? mutations.startFromStarter.error ?? mutations.instantiate.error)
          ?.message
      }
      onOpenChange={onOpenChange}
      onSubmit={async (input) => {
        const project = await createProject.mutateAsync({
          workspaceId,
          input: { ...input, codingEnvironment: null },
        });

        openProject(project.id);
      }}
      onStartFrom={
        canManage
          ? async (start) => {
              const project =
                start.kind === "starter"
                  ? await mutations.startFromStarter.mutateAsync(start.slug)
                  : await mutations.instantiate.mutateAsync(start.id);

              openProject(project.id);
            }
          : undefined
      }
      onDeleteTemplate={(templateId) =>
        void mutations.remove
          .mutateAsync(templateId)
          .then(() => toast.success("Template deleted"))
          .catch((error: unknown) =>
            toast.error(getErrorMessage(error, "The template could not be deleted")),
          )
      }
    />
  );
}
