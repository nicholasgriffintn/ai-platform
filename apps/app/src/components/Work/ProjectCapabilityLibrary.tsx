import { CapabilityLibrary } from "~/components/Capabilities/CapabilityLibrary";
import { useProjectCapabilityScope } from "~/components/Capabilities/useCapabilityLibraryController";
import { useWorkData } from "./WorkContext";

export function ProjectCapabilityLibrary({
	workspaceId,
	projectId,
}: {
	workspaceId: string;
	projectId: string;
}) {
	const { projectQuery, workspaceQuery } = useWorkData();
	const scope = useProjectCapabilityScope(
		workspaceId,
		projectId,
		projectQuery.data,
		workspaceQuery.data?.role,
		projectQuery.error as Error | null,
		projectQuery.isLoading,
	);

	return (
		<CapabilityLibrary
			scope={scope}
			title="Capabilities"
			subtitle={`Pick what ${
				projectQuery.data?.name ?? "this project"
			} can reach for. Anything you add here is available to every member.`}
		/>
	);
}
