import { useParams } from "react-router";
import { ProjectOutputs } from "~/components/Work/ProjectOutputs";

export default function ProjectOutputsPage() {
	const { workspaceId, projectId, "*": subpath = "" } = useParams();
	return workspaceId && projectId ? (
		<ProjectOutputs workspaceId={workspaceId} projectId={projectId} subpath={subpath} />
	) : null;
}
