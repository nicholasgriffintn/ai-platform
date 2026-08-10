import { useParams } from "react-router";

import { ProjectLibrary } from "~/components/Work/ProjectLibrary";

export function meta() {
	return [{ title: "Project capabilities - Polychat" }];
}

export default function ProjectLibraryPage() {
	const { workspaceId = "", projectId = "" } = useParams();
	return <ProjectLibrary workspaceId={workspaceId} projectId={projectId} />;
}
