import { ProjectBriefCard as ControlledProjectBriefCard } from "@ngriffin_uk/polychat-component-workspaces";
import { useUpdateProject } from "~/hooks/useWorkspaces";

interface ProjectBriefCardProps {
	canManage: boolean;
	embedded?: boolean;
	instructions: string;
	projectId: string;
}

export function ProjectBriefCard({
	canManage,
	embedded = false,
	instructions,
	projectId,
}: ProjectBriefCardProps) {
	const updateProject = useUpdateProject();
	return (
		<ControlledProjectBriefCard
			canManage={canManage}
			embedded={embedded}
			instructions={instructions}
			isSaving={updateProject.isPending}
			errorMessage={updateProject.error?.message}
			onSave={async (value) => {
				await updateProject.mutateAsync({ projectId, input: { instructions: value } });
			}}
		/>
	);
}
