import { useParams } from "react-router";

import { WorkspaceOverview } from "~/components/Work/WorkspaceOverview";

export function meta() {
	return [{ title: "Workspace - Polychat" }];
}

export default function WorkspacePage() {
	const { workspaceId = "" } = useParams();
	return <WorkspaceOverview workspaceId={workspaceId} />;
}
