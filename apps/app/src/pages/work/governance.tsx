import { useParams } from "react-router";
import { WorkspaceGovernance } from "~/components/Work/WorkspaceGovernance";

export default function WorkspaceGovernancePage() {
	const { workspaceId } = useParams<{ workspaceId: string }>();
	return workspaceId ? <WorkspaceGovernance workspaceId={workspaceId} /> : null;
}
