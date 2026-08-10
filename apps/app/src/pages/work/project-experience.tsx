import { useParams } from "react-router";

import { ProjectExperienceRoute } from "~/components/Work/ProjectExperienceRoute";

export function meta() {
	return [{ title: "Project experience - Polychat" }];
}

export default function ProjectExperiencePage() {
	const { workspaceId = "", projectId = "", experienceId = "", "*": subpath = "" } = useParams();
	return (
		<ProjectExperienceRoute
			workspaceId={workspaceId}
			projectId={projectId}
			experienceId={experienceId}
			subpath={subpath}
		/>
	);
}
