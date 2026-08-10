import { useParams } from "react-router";

import { ProjectApp } from "~/components/Work/ProjectApp";

export function meta() {
	return [{ title: "Project app - Polychat" }];
}

export default function ProjectAppPage() {
	const { workspaceId = "", projectId = "", appId = "" } = useParams();
	return <ProjectApp workspaceId={workspaceId} projectId={projectId} appId={appId} />;
}
