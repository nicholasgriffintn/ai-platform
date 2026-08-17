import type { ProjectDetail } from "@ngriffin_uk/polychat-schemas";
import { ProjectCodingEnvironmentCard as ControlledProjectCodingEnvironmentCard } from "@ngriffin_uk/polychat-component-workspaces";

import { useSandboxConnections, useSandboxRepositoryOptions } from "~/hooks/useSandbox";
import { useUpdateProject } from "~/hooks/useWorkspaces";

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
	const { data: connections = [], isLoading: isLoadingConnections } = useSandboxConnections();
	const { repoOptions, isLoading: isLoadingRepositories } =
		useSandboxRepositoryOptions(connections);

	return (
		<ControlledProjectCodingEnvironmentCard
			canManage={canManage}
			embedded={embedded}
			codingEnvironment={project.codingEnvironment ?? null}
			repositoryOptions={repoOptions}
			isLoadingRepositories={isLoadingConnections || isLoadingRepositories}
			isSaving={updateProject.isPending}
			errorMessage={updateProject.error?.message}
			onConnect={async ({ installationId, repository, shouldCommit }) => {
				await updateProject.mutateAsync({
					projectId: project.id,
					input: {
						codingEnvironment: {
							installationId,
							repository,
							promptStrategy: project.codingEnvironment?.promptStrategy ?? "auto",
							shouldCommit,
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
		/>
	);
}
