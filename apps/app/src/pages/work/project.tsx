import { useParams } from "react-router";

import { ProjectOverview } from "~/components/Work/ProjectOverview";

export function meta() {
	return [{ title: "Project - Polychat" }];
}

export default function ProjectPage() {
	const { workspaceId = "", projectId = "" } = useParams();
	return <ProjectOverview workspaceId={workspaceId} projectId={projectId} />;
}
