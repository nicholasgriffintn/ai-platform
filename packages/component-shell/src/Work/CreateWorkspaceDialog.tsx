import { CreateWorkspaceDialog as ControlledCreateWorkspaceDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useCreateWorkspace } from "@ngriffin_uk/polychat-library-react";
import { useNavigate } from "react-router";

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspace();

  return (
    <ControlledCreateWorkspaceDialog
      open={open}
      isSubmitting={createWorkspace.isPending}
      errorMessage={createWorkspace.error?.message}
      onOpenChange={onOpenChange}
      onSubmit={async ({ name, description }) => {
        const workspace = await createWorkspace.mutateAsync({
          name,
          description,
          colour: "#2563EB",
        });

        onOpenChange(false);
        void navigate(`/work/${workspace.id}`);
      }}
    />
  );
}
