import { CreateProjectDialog as ControlledCreateProjectDialog } from "@ngriffin_uk/polychat-component-workspaces";
import { useNavigate } from "react-router";

import { useCreateProject } from "~/hooks/useWorkspaces";

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

	return (
		<ControlledCreateProjectDialog
			open={open}
			isSubmitting={createProject.isPending}
			errorMessage={createProject.error?.message}
			onOpenChange={onOpenChange}
			onSubmit={async (input) => {
				const project = await createProject.mutateAsync({
					workspaceId,
					input: { ...input, codingEnvironment: null },
				});
				onOpenChange(false);
				navigate(`/work/${workspaceId}/projects/${project.id}`);
			}}
		/>
	);
}
