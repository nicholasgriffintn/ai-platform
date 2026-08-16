import { useParams } from "react-router";

import { ToolRunner } from "~/components/Capabilities/ToolRunner";

export function meta() {
	return [{ title: "Run a tool - Polychat" }];
}

export default function ProjectToolPage() {
	const { workspaceId = "", projectId = "", toolId = "" } = useParams();
	return (
		<ToolRunner
			backPath={`/work/${workspaceId}/projects/${projectId}/library`}
			projectId={projectId}
			toolId={toolId}
		/>
	);
}
